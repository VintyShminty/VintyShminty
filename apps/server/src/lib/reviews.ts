import { type Database, orderItems, orders, profiles, reviews } from "@vinty/db";
import type { ReviewItem, UserSummary } from "@vinty/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { loadSellerSummaries } from "./discovery.js";
import { ApiError } from "./errors.js";
import { notifyEvent } from "./event-notify.js";

type Db = NonNullable<Database["db"]>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type ReviewRecord = typeof reviews.$inferSelect;

const emptyUser = (id: string): UserSummary => ({
  id,
  username: null,
  avatarUrl: null,
  ratingAverage: null,
  reviewCount: 0,
});

/** Reviews as the app draws them, with the reviewer's card and the title of the item that was bought. */
export async function presentReviews(
  app: Pick<FastifyInstance, "db" | "storage">,
  rows: ReviewRecord[],
): Promise<ReviewItem[]> {
  if (rows.length === 0) return [];
  const reviewers = await loadSellerSummaries(app, [...new Set(rows.map((r) => r.reviewerId))]);
  const titles = await app.db
    .select({
      orderId: orderItems.orderId,
      title: sql<string>`(array_agg(${orderItems.titleSnapshot} order by ${orderItems.createdAt}, ${orderItems.id}))[1]`,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, [...new Set(rows.map((r) => r.orderId))]))
    .groupBy(orderItems.orderId);
  const titleByOrder = new Map(titles.map((t) => [t.orderId, t.title]));
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    isAutomatic: r.isAutomatic,
    createdAt: r.createdAt.toISOString(),
    reviewer: reviewers.get(r.reviewerId) ?? emptyUser(r.reviewerId),
    itemTitle: titleByOrder.get(r.orderId) ?? null,
    orderId: r.orderId,
    reviewerRole: r.reviewerRole,
    replyBody: r.replyBody,
    repliedAt: r.repliedAt?.toISOString() ?? null,
  }));
}

/** Moves the profile counters behind the star rating. Automatic and member reviews are scored apart. */
export async function bumpReviewCounters(
  tx: Tx,
  userId: string,
  kind: "member" | "automatic",
  countDelta: number,
  ratingDelta: number,
) {
  await tx
    .update(profiles)
    .set(
      kind === "member"
        ? {
            memberReviewCount: sql`greatest(${profiles.memberReviewCount} + ${countDelta}, 0)`,
            memberRatingSum: sql`greatest(${profiles.memberRatingSum} + ${ratingDelta}, 0)`,
          }
        : {
            automaticReviewCount: sql`greatest(${profiles.automaticReviewCount} + ${countDelta}, 0)`,
            automaticRatingSum: sql`greatest(${profiles.automaticRatingSum} + ${ratingDelta}, 0)`,
          },
    )
    .where(eq(profiles.userId, userId));
}

/** The automatic review a completed sale leaves for the buyer to the seller. Returns whether it was created. */
export async function leaveAutomaticReview(
  tx: Tx,
  order: { id: string; buyerId: string; sellerId: string },
  rating: number,
): Promise<boolean> {
  const inserted = await tx
    .insert(reviews)
    .values({
      orderId: order.id,
      reviewerId: order.buyerId,
      revieweeId: order.sellerId,
      reviewerRole: "buyer",
      rating,
      isAutomatic: true,
    })
    .onConflictDoNothing()
    .returning({ id: reviews.id });
  if (inserted.length === 0) return false;
  await bumpReviewCounters(tx, order.sellerId, "automatic", 1, rating);
  return true;
}

export async function reviewsOfOrder(db: Db, orderId: string): Promise<ReviewRecord[]> {
  return db.select().from(reviews).where(eq(reviews.orderId, orderId));
}

export async function findReview(db: Db, id: string) {
  const [row] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return row;
}

/**
 * Feedback after a completed order. Each person can review the other once. A buyer's review replaces the automatic
 * one that the completed sale left behind.
 */
export async function submitReview(
  app: FastifyInstance,
  userId: string,
  orderId: string,
  input: { rating: number; comment?: string | undefined },
): Promise<ReviewItem> {
  const [order] = await app.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) throw ApiError.notFound();
  if (order.status !== "completed") {
    throw new ApiError(409, "invalid_transition", "Feedback opens when the order is complete");
  }
  const role = order.buyerId === userId ? "buyer" : "seller";
  const revieweeId = role === "buyer" ? order.sellerId : order.buyerId;
  const now = new Date();

  const row = await app.db.transaction(async (tx) => {
    // Serialise the two taps of one person on one order.
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for("update");
    const [existing] = await tx
      .select()
      .from(reviews)
      .where(and(eq(reviews.orderId, orderId), eq(reviews.reviewerId, userId)))
      .limit(1);
    if (existing && !existing.isAutomatic) {
      throw ApiError.conflict("You already left feedback for this order");
    }
    if (existing) {
      const [updated] = await tx
        .update(reviews)
        .set({ rating: input.rating, comment: input.comment ?? null, isAutomatic: false, createdAt: now })
        .where(eq(reviews.id, existing.id))
        .returning();
      await bumpReviewCounters(tx, revieweeId, "automatic", -1, -existing.rating);
      await bumpReviewCounters(tx, revieweeId, "member", 1, input.rating);
      return updated;
    }
    const [inserted] = await tx
      .insert(reviews)
      .values({
        orderId,
        reviewerId: userId,
        revieweeId,
        reviewerRole: role,
        rating: input.rating,
        comment: input.comment ?? null,
      })
      .returning();
    await bumpReviewCounters(tx, revieweeId, "member", 1, input.rating);
    return inserted;
  });
  if (!row) throw new Error("Review was not saved");

  const [item] = await presentReviews(app, [row]);
  if (!item) throw new Error("Review could not be presented");
  try {
    await notifyEvent(app, {
      userId: revieweeId,
      type: "review_received",
      actorId: userId,
      orderId,
      conversationId: order.conversationId,
      data: { orderId, rating: input.rating, title: item.itemTitle ?? "", role },
    });
  } catch (err) {
    app.log.error({ err }, "could not notify about a review");
  }
  return item;
}

/** The reviewed person's public reply. Replying again replaces it. Automatic reviews have nothing to reply to. */
export async function replyToReview(
  app: FastifyInstance,
  userId: string,
  reviewId: string,
  body: string,
): Promise<ReviewItem> {
  const existing = await findReview(app.db, reviewId);
  if (!existing || existing.revieweeId !== userId) throw ApiError.notFound();
  if (existing.isAutomatic) throw ApiError.conflict("An automatic review cannot be replied to");
  const [row] = await app.db
    .update(reviews)
    .set({ replyBody: body, repliedAt: new Date() })
    .where(eq(reviews.id, reviewId))
    .returning();
  if (!row) throw new Error("Reply was not saved");
  const [item] = await presentReviews(app, [row]);
  if (!item) throw new Error("Review could not be presented");
  return item;
}
