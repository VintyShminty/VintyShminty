import { listings, profiles, reviews, users } from "@vinty/db";
import {
  errorResponseSchema,
  feedPageSchema,
  idSchema,
  publicProfileSchema,
  type ReviewItem,
  reviewsPageSchema,
  reviewsQuerySchema,
  userListingsQuerySchema,
} from "@vinty/shared";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import { filterConditions, queryCardRows, sortSpec, toCards } from "../lib/discovery.js";
import { ApiError } from "../lib/errors.js";
import { loadPublicProfile } from "../lib/profiles.js";
import { optionalViewerId } from "../lib/viewer.js";

const idParams = z.object({ id: idSchema });

/**
 * Read only profile endpoints. They belong to Milestone 3 in docs/blueprint/api.md and arrive early
 * because the Profile tab needs them.
 */
const userRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db, storage } = app;

  const viewerIdOf = (request: Parameters<typeof optionalViewerId>[1]) => optionalViewerId(app, request);

  app.get(
    "/v1/users/:id",
    {
      schema: { params: idParams, response: { 200: publicProfileSchema, 404: errorResponseSchema } },
    },
    async (request) => {
      const profile = await loadPublicProfile(app, request.params.id, await viewerIdOf(request));
      if (!profile) throw ApiError.notFound();
      return profile;
    },
  );

  app.get(
    "/v1/users/:id/listings",
    {
      schema: {
        params: idParams,
        querystring: userListingsQuerySchema,
        response: { 200: feedPageSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { status, cursor, limit, sort, ...filters } = request.query;
      const [owner] = await db
        .select({ deletedAt: profiles.deletedAt })
        .from(profiles)
        .where(eq(profiles.userId, id))
        .limit(1);
      if (!owner || owner.deletedAt) throw ApiError.notFound();

      const viewerId = await viewerIdOf(request);
      const reference = await app.reference.get();
      // The Active chip holds reserved items too. A seller on holiday still shows their own page.
      const statuses = status === "sold" ? (["sold"] as const) : (["active", "reserved"] as const);
      const where = [
        eq(listings.sellerId, id),
        inArray(listings.status, [...statuses]),
        ...filterConditions(filters, reference),
      ];
      const page = await queryCardRows(db, { where, sort: sortSpec(sort, filters.q), cursor, limit });
      return { items: await toCards(app, reference, page.rows, { viewerId }), nextCursor: page.nextCursor };
    },
  );

  app.get(
    "/v1/users/:id/reviews",
    {
      schema: {
        params: idParams,
        querystring: reviewsQuerySchema,
        response: { 200: reviewsPageSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { source, limit } = request.query;
      const [owner] = await db.select().from(profiles).where(eq(profiles.userId, id)).limit(1);
      if (!owner || owner.deletedAt) throw ApiError.notFound();

      const cursor = decodeCursor<{ c: string; i: string }>(request.query.cursor);
      const reviewerProfile = profiles;
      const rows = await db
        .select({
          review: reviews,
          reviewerUsername: users.displayUsername,
          reviewerHandle: users.username,
          avatarKey: reviewerProfile.avatarKey,
          reviewerCount: reviewerProfile.memberReviewCount,
          reviewerSum: reviewerProfile.memberRatingSum,
          reviewerDeleted: reviewerProfile.deletedAt,
          itemTitle: sql<
            string | null
          >`(select title_snapshot from order_items oi where oi.order_id = ${reviews.orderId} order by oi.created_at limit 1)`,
        })
        .from(reviews)
        .innerJoin(users, eq(users.id, reviews.reviewerId))
        .innerJoin(reviewerProfile, eq(reviewerProfile.userId, reviews.reviewerId))
        .where(
          and(
            eq(reviews.revieweeId, id),
            source === "member" ? eq(reviews.isAutomatic, false) : undefined,
            source === "automatic" ? eq(reviews.isAutomatic, true) : undefined,
            cursor
              ? or(
                  lt(reviews.createdAt, new Date(cursor.c)),
                  and(eq(reviews.createdAt, new Date(cursor.c)), lt(reviews.id, cursor.i)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(reviews.createdAt), desc(reviews.id))
        .limit(limit + 1);

      const page = rows.slice(0, limit);
      const items: ReviewItem[] = page.map((r) => ({
        id: r.review.id,
        rating: r.review.rating,
        comment: r.review.comment,
        isAutomatic: r.review.isAutomatic,
        createdAt: r.review.createdAt.toISOString(),
        reviewer: {
          id: r.review.reviewerId,
          username: r.reviewerDeleted ? null : (r.reviewerUsername ?? r.reviewerHandle),
          avatarUrl: !r.reviewerDeleted && r.avatarKey ? storage.publicUrl(r.avatarKey) : null,
          ratingAverage:
            r.reviewerCount > 0 ? Math.round((r.reviewerSum / r.reviewerCount) * 100) / 100 : null,
          reviewCount: r.reviewerCount,
        },
        itemTitle: r.itemTitle,
        orderId: r.review.orderId,
        reviewerRole: r.review.reviewerRole,
        replyBody: r.review.replyBody,
        repliedAt: r.review.repliedAt?.toISOString() ?? null,
      }));

      const avg = (sum: number, count: number) => (count > 0 ? Math.round((sum / count) * 100) / 100 : null);
      const total = owner.memberReviewCount + owner.automaticReviewCount;
      const last = page.at(-1)?.review;
      return {
        items,
        nextCursor:
          rows.length > limit && last ? encodeCursor({ c: last.createdAt.toISOString(), i: last.id }) : null,
        summary: {
          member: {
            count: owner.memberReviewCount,
            average: avg(owner.memberRatingSum, owner.memberReviewCount),
          },
          automatic: {
            count: owner.automaticReviewCount,
            average: avg(owner.automaticRatingSum, owner.automaticReviewCount),
          },
          overall: avg(owner.memberRatingSum + owner.automaticRatingSum, total),
          total,
        },
      };
    },
  );
};

export default userRoutes;
