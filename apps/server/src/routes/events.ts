import {
  brands,
  feedHidden,
  feedSnapshots,
  listings,
  profiles,
  userEvents,
  userSettings,
  users,
} from "@vinty/db";
import {
  DWELL_MIN_MS,
  DWELL_MIN_PHOTOS,
  EVENTS_PER_MINUTE,
  errorResponseSchema,
  eventBatchResultSchema,
  eventBatchSchema,
  findCategory,
  type HiddenItem,
  hiddenItemSchema,
  hiddenListSchema,
  hideInputSchema,
  idSchema,
  onboardingPicksSchema,
  shopsForSchema,
} from "@vinty/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { type EventInput, recordEvents, resetLearnedTaste } from "../lib/events.js";
import { WindowLimiter } from "../lib/limiter.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = { 401: errorResponseSchema };
const HIDDEN_MAX = 200;
const DAY_MS = 86_400_000;

/**
 * What the home feed learns from the phone (Milestone 7): batches of "card seen", "time on item" and "category visit",
 * "Not interested", the reset button and the two questions after sign up. Everything else the feed learns, the server
 * records itself in the handlers that see it (see lib/events.ts).
 */
const eventRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const preHandler = app.requireUser;
  const limiter = new WindowLimiter(EVENTS_PER_MINUTE, 60_000);

  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  // ---- Batches from the phone ----

  app.post(
    "/v1/events",
    {
      preHandler,
      // The real limit is 200 actions per person per minute, counted below. This only guards the request count.
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      schema: {
        body: eventBatchSchema,
        response: { 200: eventBatchResultSchema, ...errors, 429: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { events } = request.body;
      if (!limiter.takeMany(userId, events.length)) {
        throw new ApiError(
          429,
          "rate_limited",
          "Too many actions at once",
          undefined,
          limiter.retryAfterSeconds(userId),
        );
      }
      const reference = await app.reference.get();
      const now = Date.now();
      let invalid = 0;
      const inputs: EventInput[] = [];
      for (const e of events) {
        const at = e.occurredAt ? new Date(e.occurredAt).getTime() : now;
        // A phone clock that is wrong must not write into the future or far back.
        const occurredAt = at > now || now - at > DAY_MS ? undefined : new Date(at);
        const base = {
          type: e.type,
          clientEventId: e.clientEventId,
          surface: e.surface,
          position: e.position,
          feedId: e.feedId,
          occurredAt,
        };
        if (e.type === "category_visit") {
          if (!e.categoryId || !findCategory(reference.categories, e.categoryId)) {
            invalid += 1;
            continue;
          }
          inputs.push({ ...base, categoryId: e.categoryId });
        } else if (e.type === "listing_dwell") {
          const ms = e.data?.dwellMs ?? 0;
          const photos = e.data?.photosSwiped ?? 0;
          if (!e.listingId || (ms < DWELL_MIN_MS && photos < DWELL_MIN_PHOTOS)) {
            invalid += 1;
            continue;
          }
          inputs.push({ ...base, listingId: e.listingId, data: { dwellMs: ms, photosSwiped: photos } });
        } else {
          if (!e.listingId) {
            invalid += 1;
            continue;
          }
          inputs.push({ ...base, listingId: e.listingId });
        }
      }
      const result = await recordEvents(app, userId, inputs);
      return { recorded: result.recorded, skipped: result.skipped + invalid };
    },
  );

  // ---- Not interested ----

  const presentHidden = async (rows: (typeof feedHidden.$inferSelect)[]): Promise<HiddenItem[]> => {
    const reference = await app.reference.get();
    const idsOf = (scope: string) => rows.filter((r) => r.scope === scope).map((r) => r.targetId);
    const [titles, names, brandNames] = await Promise.all([
      idsOf("item").length
        ? db
            .select({ id: listings.id, label: listings.title })
            .from(listings)
            .where(inArray(listings.id, idsOf("item")))
        : [],
      idsOf("seller").length
        ? db
            .select({
              id: users.id,
              label: sql<string>`coalesce(${users.displayUsername}, ${users.username})`,
            })
            .from(users)
            .where(inArray(users.id, idsOf("seller")))
        : [],
      idsOf("brand").length
        ? db
            .select({ id: brands.id, label: brands.name })
            .from(brands)
            .where(inArray(brands.id, idsOf("brand")))
        : [],
    ]);
    const labels = new Map([...titles, ...names, ...brandNames].map((r) => [r.id, r.label]));
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      targetId: r.targetId,
      label: labels.get(r.targetId) ?? null,
      categoryName:
        r.scope === "category" ? (findCategory(reference.categories, r.targetId)?.name ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    }));
  };

  app.post(
    "/v1/feed/hide",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: hideInputSchema,
        response: { 200: hiddenItemSchema, 201: hiddenItemSchema, ...errors, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { scope, targetId } = request.body;
      const reference = await app.reference.get();

      if (scope === "item") {
        const [row] = await db
          .select({ sellerId: listings.sellerId, status: listings.status })
          .from(listings)
          .where(eq(listings.id, targetId))
          .limit(1);
        if (!row || row.sellerId === userId || row.status === "draft" || row.status === "removed")
          throw ApiError.notFound();
      } else if (scope === "seller") {
        const [row] = await db
          .select({ id: profiles.userId })
          .from(profiles)
          .where(and(eq(profiles.userId, targetId), sql`${profiles.deletedAt} is null`))
          .limit(1);
        if (!row || row.id === userId) throw ApiError.notFound();
      } else if (scope === "brand") {
        const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.id, targetId)).limit(1);
        if (!row) throw ApiError.notFound();
      } else if (!findCategory(reference.categories, targetId)) {
        throw ApiError.notFound();
      }

      const inserted = await db
        .insert(feedHidden)
        .values({ userId, scope, targetId })
        .onConflictDoNothing()
        .returning();
      const row =
        inserted[0] ??
        (
          await db
            .select()
            .from(feedHidden)
            .where(
              and(
                eq(feedHidden.userId, userId),
                eq(feedHidden.scope, scope),
                eq(feedHidden.targetId, targetId),
              ),
            )
            .limit(1)
        )[0];
      if (!row) throw new Error("Hide was not saved");
      if (inserted[0]) {
        await recordEvents(app, userId, [
          {
            type: "not_interested",
            ...(scope === "item" ? { listingId: targetId } : {}),
            ...(scope === "seller" ? { sellerId: targetId } : {}),
            ...(scope === "brand" ? { brandId: targetId } : {}),
            ...(scope === "category" ? { categoryId: targetId } : {}),
          },
        ]);
      }
      const [item] = await presentHidden([row]);
      return reply.code(inserted[0] ? 201 : 200).send(item as HiddenItem);
    },
  );

  app.get(
    "/v1/feed/hidden",
    { preHandler, schema: { response: { 200: hiddenListSchema, ...errors } } },
    async (request) => {
      const rows = await db
        .select()
        .from(feedHidden)
        .where(eq(feedHidden.userId, userIdOf(request)))
        .orderBy(desc(feedHidden.createdAt), desc(feedHidden.id))
        .limit(HIDDEN_MAX);
      return { items: await presentHidden(rows) };
    },
  );

  app.delete(
    "/v1/feed/hidden/:id",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 204: z.null(), ...errors, 404: errorResponseSchema } },
    },
    async (request, reply) => {
      const removed = await db
        .delete(feedHidden)
        .where(and(eq(feedHidden.id, request.params.id), eq(feedHidden.userId, userIdOf(request))))
        .returning({ id: feedHidden.id });
      if (removed.length === 0) throw ApiError.notFound();
      return reply.code(204).send(null);
    },
  );

  // ---- Reset ----

  app.delete(
    "/v1/me/personalisation",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { response: { 204: z.null(), ...errors } },
    },
    async (request, reply) => {
      // Clears what the feed learned. Hearts, sizes, followed brands and sellers, and hides stay.
      await resetLearnedTaste(db, userIdOf(request));
      return reply.code(204).send(null);
    },
  );

  // ---- What do you shop for (a lasting setting, plan section 11.1) ----

  const saveShopsFor = async <T extends string>(userId: string, picks: readonly T[]): Promise<T[]> => {
    const shopsFor = [...new Set(picks)];
    await db
      .insert(userSettings)
      .values({ userId, shopsFor })
      .onConflictDoUpdate({ target: userSettings.userId, set: { shopsFor } });
    // The next Home starts a fresh list with the new groups.
    await db.delete(feedSnapshots).where(eq(feedSnapshots.userId, userId));
    return shopsFor;
  };

  app.get(
    "/v1/me/personalisation/shops-for",
    { preHandler, schema: { response: { 200: shopsForSchema, ...errors } } },
    async (request) => {
      const [row] = await db
        .select({ shopsFor: userSettings.shopsFor })
        .from(userSettings)
        .where(eq(userSettings.userId, userIdOf(request)))
        .limit(1);
      return shopsForSchema.parse({ shopsFor: row?.shopsFor ?? [] });
    },
  );

  app.put(
    "/v1/me/personalisation/shops-for",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { body: shopsForSchema, response: { 200: shopsForSchema, ...errors } },
    },
    async (request) => ({ shopsFor: await saveShopsFor(userIdOf(request), request.body.shopsFor) }),
  );

  // ---- After sign up ----

  app.post(
    "/v1/me/onboarding-picks",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { body: onboardingPicksSchema, response: { 204: z.null(), ...errors } },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const reference = await app.reference.get();
      // The answer is kept as a setting that never fades. Skipping (no picks) leaves an earlier answer alone.
      if (request.body.picks.length > 0) await saveShopsFor(userId, request.body.picks);
      const picked = [...new Set(request.body.picks)].flatMap((slug) => {
        const node = reference.categories.find((c) => c.slug === slug);
        return node ? [node.id] : [];
      });
      // Answering twice does not count twice.
      const before = picked.length
        ? await db
            .select({ categoryId: userEvents.categoryId })
            .from(userEvents)
            .where(
              and(
                eq(userEvents.userId, userId),
                eq(userEvents.type, "onboarding_pick"),
                inArray(userEvents.categoryId, picked),
              ),
            )
        : [];
      const done = new Set(before.map((b) => b.categoryId));
      await recordEvents(
        app,
        userId,
        picked
          .filter((id) => !done.has(id))
          .map((categoryId) => ({ type: "onboarding_pick" as const, categoryId })),
      );
      return reply.code(204).send(null);
    },
  );
};

export default eventRoutes;
