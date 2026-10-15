import { bumpPlans, bumps, listingPhotos, listings } from "@vinty/db";
import type { Bump, BumpPlan, MyBump } from "@vinty/shared";
import { and, asc, desc, eq, isNotNull, lt, lte, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { decodeCursor, encodeCursor } from "./cursor.js";
import { ApiError } from "./errors.js";
import { notifyEvent } from "./event-notify.js";
import { toCardPhoto } from "./listings.js";

type PlanRow = typeof bumpPlans.$inferSelect;
type BumpRow = typeof bumps.$inferSelect;

const HOUR_MS = 3_600_000;

export const toPlan = (row: PlanRow): BumpPlan => ({
  id: row.id,
  slug: row.slug,
  name: { en: row.nameEn, he: row.nameHe },
  durationHours: row.durationHours,
  priceMinor: row.priceMinor,
  currency: row.currency,
});

const toBump = (row: BumpRow): Bump => ({
  id: row.id,
  listingId: row.listingId,
  planId: row.planId,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  pricePaidMinor: row.pricePaidMinor,
  currency: row.currency,
  payment: "free",
});

export async function listActivePlans(app: Pick<FastifyInstance, "db">): Promise<BumpPlan[]> {
  const rows = await app.db
    .select()
    .from(bumpPlans)
    .where(eq(bumpPlans.isActive, true))
    .orderBy(asc(bumpPlans.durationHours));
  return rows.map(toPlan);
}

/**
 * Gives one of the seller's active items buzz. Free in version 1. The item row is locked while we check, so two
 * taps at once make one buzz. The item moves to the top (`bumped_at`) and shows Buzzing until `bumped_until`.
 */
export async function giveBuzz(
  app: Pick<FastifyInstance, "db">,
  userId: string,
  listingId: string,
  planId: string,
  now = new Date(),
): Promise<Bump> {
  return app.db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.sellerId, userId)))
      .for("update")
      .limit(1);
    if (!listing) throw ApiError.notFound("Listing not found");
    if (listing.status !== "active") throw ApiError.conflict("Only listings for sale can be boosted");
    if (listing.bumpedUntil && listing.bumpedUntil > now)
      throw ApiError.conflict("This listing is already boosted");

    const [plan] = await tx
      .select()
      .from(bumpPlans)
      .where(and(eq(bumpPlans.id, planId), eq(bumpPlans.isActive, true)))
      .limit(1);
    if (!plan) throw ApiError.invalid("Choose a boost plan", { planId: "validation.bump.planUnknown" });

    const endsAt = new Date(now.getTime() + plan.durationHours * HOUR_MS);
    const [row] = await tx
      .insert(bumps)
      .values({
        listingId,
        userId,
        planId: plan.id,
        pricePaidMinor: 0,
        currency: plan.currency,
        paymentProvider: "free",
        startsAt: now,
        endsAt,
      })
      .returning();
    if (!row) throw new Error("Buzz was not saved");
    await tx.update(listings).set({ bumpedAt: now, bumpedUntil: endsAt }).where(eq(listings.id, listingId));
    return toBump(row);
  });
}

/** The seller's buzzes, newest first, each with its item. */
export async function listMyBumps(
  app: Pick<FastifyInstance, "db" | "storage">,
  userId: string,
  limit: number,
  cursorText: string | undefined,
  now = new Date(),
): Promise<{ items: MyBump[]; nextCursor: string | null }> {
  const cursor = decodeCursor<{ s: string; i: string }>(cursorText);
  const rows = await app.db
    .select({
      bump: bumps,
      plan: bumpPlans,
      listingId: listings.id,
      title: listings.title,
      status: listings.status,
      coverKey: listingPhotos.objectKey,
      coverWidth: listingPhotos.width,
      coverHeight: listingPhotos.height,
      coverPlaceholder: listingPhotos.placeholder,
      coverCardKey: listingPhotos.cardObjectKey,
    })
    .from(bumps)
    .innerJoin(bumpPlans, eq(bumpPlans.id, bumps.planId))
    .innerJoin(listings, eq(listings.id, bumps.listingId))
    .leftJoin(listingPhotos, and(eq(listingPhotos.listingId, listings.id), eq(listingPhotos.position, 0)))
    .where(
      and(
        eq(bumps.userId, userId),
        cursor
          ? or(
              lt(bumps.startsAt, new Date(cursor.s)),
              and(eq(bumps.startsAt, new Date(cursor.s)), lt(bumps.id, cursor.i)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(bumps.startsAt), desc(bumps.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1)?.bump;
  return {
    items: page.map((r) => ({
      ...toBump(r.bump),
      isActive: r.bump.endsAt > now && r.bump.startsAt <= now,
      plan: {
        slug: r.plan.slug,
        name: { en: r.plan.nameEn, he: r.plan.nameHe },
        durationHours: r.plan.durationHours,
      },
      listing: {
        id: r.listingId,
        title: r.title,
        status: r.status,
        cover:
          r.coverKey && r.coverWidth && r.coverHeight
            ? toCardPhoto(app.storage, {
                objectKey: r.coverKey,
                width: r.coverWidth,
                height: r.coverHeight,
                placeholder: r.coverPlaceholder,
                cardObjectKey: r.coverCardKey,
              })
            : null,
      },
    })),
    nextCursor:
      rows.length > limit && last ? encodeCursor({ s: last.startsAt.toISOString(), i: last.id }) : null,
  };
}

/**
 * The daily end step: items whose buzz ran out stop being marked (`bumped_until` goes back to empty, the history
 * stays in `bumps`) and the seller hears "the buzz has ended" once, only if the item is still for sale. Clearing
 * the date and reading the rows is one statement, so running twice never tells anyone twice.
 */
export async function endFinishedBuzzes(
  app: FastifyInstance,
  now = new Date(),
): Promise<{ buzzesEnded: number }> {
  const ended = await app.db
    .update(listings)
    .set({ bumpedUntil: null })
    .where(and(isNotNull(listings.bumpedUntil), lte(listings.bumpedUntil, now)))
    .returning({
      id: listings.id,
      sellerId: listings.sellerId,
      title: listings.title,
      status: listings.status,
    });
  for (const l of ended) {
    if (l.status !== "active" && l.status !== "reserved") continue;
    try {
      await notifyEvent(app, {
        userId: l.sellerId,
        type: "bump_ended",
        listingId: l.id,
        data: { title: l.title },
      });
    } catch (err) {
      app.log.error({ err, listingId: l.id }, "buzz ended notification failed");
    }
  }
  return { buzzesEnded: ended.length };
}
