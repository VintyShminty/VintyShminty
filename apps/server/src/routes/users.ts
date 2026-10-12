import { feeRules, listingPhotos, listings, profiles, reviews, users } from "@vinty/db";
import {
  calculateBuyerProtectionFee,
  errorResponseSchema,
  idSchema,
  type ListingCard,
  listingCardSchema,
  pageSchema,
  paginationQuerySchema,
  publicProfileSchema,
  type ReviewItem,
  reviewsPageSchema,
  reviewsQuerySchema,
} from "@vinty/shared";
import { fromNodeHeaders } from "better-auth/node";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import { ApiError } from "../lib/errors.js";
import { loadPublicProfile } from "../lib/profiles.js";

const idParams = z.object({ id: idSchema });
const listingsQuery = paginationQuerySchema.extend({ status: z.enum(["active", "sold"]).default("active") });

/**
 * Read only profile endpoints. They belong to Milestone 3 in docs/blueprint/api.md and arrive early
 * because the Profile tab needs them.
 */
const userRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db, storage } = app;

  /** Optional auth: a bad or missing session is just "not signed in". */
  const viewerId = async (headers: Parameters<typeof fromNodeHeaders>[0]) => {
    try {
      const session = await app.auth.api.getSession({ headers: fromNodeHeaders(headers) });
      return session?.user.id;
    } catch {
      return undefined;
    }
  };

  app.get(
    "/v1/users/:id",
    {
      schema: { params: idParams, response: { 200: publicProfileSchema, 404: errorResponseSchema } },
    },
    async (request) => {
      const profile = await loadPublicProfile(app, request.params.id, await viewerId(request.headers));
      if (!profile) throw ApiError.notFound();
      return profile;
    },
  );

  app.get(
    "/v1/users/:id/listings",
    {
      schema: {
        params: idParams,
        querystring: listingsQuery,
        response: { 200: pageSchema(listingCardSchema), 404: errorResponseSchema },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { status, limit } = request.query;
      const [owner] = await db
        .select({ deletedAt: profiles.deletedAt })
        .from(profiles)
        .where(eq(profiles.userId, id))
        .limit(1);
      if (!owner || owner.deletedAt) throw ApiError.notFound();

      const cursor = decodeCursor<{ b: string; i: string }>(request.query.cursor);
      const statuses = status === "sold" ? (["sold"] as const) : (["active", "reserved"] as const);
      const rows = await db
        .select({
          listing: listings,
          coverKey: listingPhotos.objectKey,
          coverWidth: listingPhotos.width,
          coverHeight: listingPhotos.height,
          coverPlaceholder: listingPhotos.placeholder,
        })
        .from(listings)
        .leftJoin(listingPhotos, and(eq(listingPhotos.listingId, listings.id), eq(listingPhotos.position, 0)))
        .where(
          and(
            eq(listings.sellerId, id),
            inArray(listings.status, [...statuses]),
            cursor
              ? or(
                  lt(listings.bumpedAt, new Date(cursor.b)),
                  and(eq(listings.bumpedAt, new Date(cursor.b)), lt(listings.id, cursor.i)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(listings.bumpedAt), desc(listings.id))
        .limit(limit + 1);

      const feeRows = await db
        .select()
        .from(feeRules)
        .where(eq(feeRules.isActive, true))
        .orderBy(desc(feeRules.activeFrom));
      const feeFor = (currency: string) => feeRows.find((f) => f.currency === currency);

      const page = rows.slice(0, limit);
      const items: ListingCard[] = page.map(
        ({ listing: l, coverKey, coverWidth, coverHeight, coverPlaceholder }) => {
          const price = l.priceMinor ?? 0;
          const fee = feeFor(l.currency);
          return {
            id: l.id,
            status: l.status,
            title: l.title,
            brandName: l.brandName,
            sizeLabel: null,
            conditionSlug: null,
            priceMinor: price,
            buyerPriceMinor: price + (fee ? calculateBuyerProtectionFee(price, fee) : 0),
            previousPriceMinor: l.previousPriceMinor,
            currency: l.currency,
            cover:
              coverKey && coverWidth && coverHeight
                ? {
                    key: coverKey,
                    url: storage.publicUrl(coverKey),
                    width: coverWidth,
                    height: coverHeight,
                    placeholder: coverPlaceholder,
                  }
                : null,
            favouriteCount: l.favouriteCount,
            isBumped: Boolean(l.bumpedUntil && l.bumpedUntil > new Date()),
          };
        },
      );
      const last = page.at(-1)?.listing;
      return {
        items,
        nextCursor:
          rows.length > limit && last ? encodeCursor({ b: last.bumpedAt.toISOString(), i: last.id }) : null,
      };
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
