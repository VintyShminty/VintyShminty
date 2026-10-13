import {
  blocks,
  conversations,
  favourites,
  listings,
  messages,
  profiles,
  recentSearches,
  reports,
  reviews,
  savedSearches,
  sizes,
  userSizes,
} from "@vinty/db";
import {
  createRecentSearchInputSchema,
  createReportInputSchema,
  createSavedSearchInputSchema,
  errorResponseSchema,
  favouriteResultSchema,
  favouritesQuerySchema,
  feedPageSchema,
  idSchema,
  personalisationSizesSchema,
  RECENT_SEARCHES_MAX,
  recentSearchListSchema,
  SAVED_SEARCH_MAX,
  savedSearchListSchema,
  savedSearchSchema,
  searchFiltersSchema,
  updateSavedSearchInputSchema,
} from "@vinty/shared";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { queryCardRows, searchTokens, toCards } from "../lib/discovery.js";
import { ApiError } from "../lib/errors.js";
import { notifyUser } from "../lib/notify.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = { 401: errorResponseSchema, 404: errorResponseSchema };

/** Favourites, saved and recent searches, reports and personalisation sizes (Milestone 3). */
const engagementRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const preHandler = app.requireUser;

  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  // ---- Favourites ----

  async function countOf(listingId: string): Promise<number> {
    const [row] = await db
      .select({ n: listings.favouriteCount })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    return row?.n ?? 0;
  }

  app.put(
    "/v1/listings/:id/favourite",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        response: {
          200: favouriteResultSchema,
          ...errors,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const [row] = await db.select().from(listings).where(eq(listings.id, request.params.id)).limit(1);
      if (!row || row.status === "draft" || row.status === "hidden" || row.status === "removed") {
        throw ApiError.notFound();
      }
      if (row.sellerId === userId) throw ApiError.forbidden("You cannot favourite your own item");
      const [blocked] = await db
        .select({ one: sql<number>`1` })
        .from(blocks)
        .where(
          sql`(${blocks.blockerId} = ${userId} and ${blocks.blockedId} = ${row.sellerId}) or (${blocks.blockerId} = ${row.sellerId} and ${blocks.blockedId} = ${userId})`,
        )
        .limit(1);
      if (blocked) throw ApiError.notFound();

      const [already] = await db
        .select({ id: favourites.listingId })
        .from(favourites)
        .where(and(eq(favourites.userId, userId), eq(favourites.listingId, row.id)))
        .limit(1);
      if (already) return { favouriteCount: row.favouriteCount };
      // Hearts on a sold item are kept (Favourites shows it with the Sold band) but new ones make no sense.
      if (row.status === "sold") throw new ApiError(409, "listing_unavailable", "This item has been sold");

      const { count, added } = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(favourites)
          .values({ userId, listingId: row.id })
          .onConflictDoNothing()
          .returning({ id: favourites.listingId });
        if (inserted.length === 0) return { count: await countOf(row.id), added: false };
        const [updated] = await tx
          .update(listings)
          // A heart is not an edit: keep updated_at as it is.
          .set({ favouriteCount: sql`${listings.favouriteCount} + 1`, updatedAt: sql`${listings.updatedAt}` })
          .where(eq(listings.id, row.id))
          .returning({ n: listings.favouriteCount });
        return { count: updated?.n ?? 0, added: true };
      });
      if (!added) return { favouriteCount: count };
      // One notification per item, grouped: further hearts while it is unread raise its count.
      // It goes through notifyUser so the seller's open app hears about it at once. No push text yet.
      await notifyUser(app, {
        userId: row.sellerId,
        type: "listing_favourited",
        actorId: userId,
        listingId: row.id,
        data: { title: row.title },
        groupByListing: true,
      });
      return { favouriteCount: count };
    },
  );

  app.delete(
    "/v1/listings/:id/favourite",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 200: favouriteResultSchema, ...errors } },
    },
    async (request) => {
      const userId = userIdOf(request);
      const id = request.params.id;
      const [row] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, id)).limit(1);
      if (!row) throw ApiError.notFound();
      await db.transaction(async (tx) => {
        const removed = await tx
          .delete(favourites)
          .where(and(eq(favourites.userId, userId), eq(favourites.listingId, id)))
          .returning({ id: favourites.listingId });
        if (removed.length === 0) return;
        await tx
          .update(listings)
          .set({
            favouriteCount: sql`greatest(${listings.favouriteCount} - 1, 0)`,
            updatedAt: sql`${listings.updatedAt}`,
          })
          .where(eq(listings.id, id));
      });
      return { favouriteCount: await countOf(id) };
    },
  );

  app.get(
    "/v1/me/favourites",
    {
      preHandler,
      schema: {
        querystring: favouritesQuerySchema,
        response: { 200: feedPageSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const reference = await app.reference.get();
      const { q, limit, cursor } = request.query;
      const tokens = searchTokens(q);
      const where = [
        sql`exists (select 1 from ${favourites} where ${favourites.userId} = ${userId} and ${favourites.listingId} = ${listings.id})`,
        // Sold items stay in the list (green band). Drafts, hidden and removed ones do not.
        inArray(listings.status, ["active", "reserved", "sold"]),
        sql`not exists (select 1 from ${blocks} where (${blocks.blockerId} = ${userId} and ${blocks.blockedId} = ${listings.sellerId}) or (${blocks.blockerId} = ${listings.sellerId} and ${blocks.blockedId} = ${userId}))`,
        ...tokens.map((t) => {
          const like = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
          return sql`(${listings.title} ilike ${like} or coalesce(${listings.brandName}, '') ilike ${like})`;
        }),
      ];
      // Newest heart first.
      const key = sql`(select (extract(epoch from ${favourites.createdAt}) * 1000)::bigint from ${favourites} where ${favourites.userId} = ${userId} and ${favourites.listingId} = ${listings.id})`;
      const page = await queryCardRows(db, { where, sort: { key, dir: "desc" }, cursor, limit });
      return {
        items: await toCards(app, reference, page.rows, { viewerId: userId, withSeller: true }),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ---- Saved searches ----

  const savedView = (row: typeof savedSearches.$inferSelect) => {
    const filters = searchFiltersSchema.safeParse(row.filters);
    return {
      id: row.id,
      queryText: row.queryText,
      filters: filters.success ? filters.data : searchFiltersSchema.parse({}),
      notifyOnNew: row.notifyOnNew,
      createdAt: row.createdAt.toISOString(),
    };
  };

  app.get(
    "/v1/me/saved-searches",
    { preHandler, schema: { response: { 200: savedSearchListSchema, 401: errorResponseSchema } } },
    async (request) => {
      const rows = await db
        .select()
        .from(savedSearches)
        .where(eq(savedSearches.userId, userIdOf(request)))
        .orderBy(desc(savedSearches.createdAt), desc(savedSearches.id))
        .limit(SAVED_SEARCH_MAX);
      return { items: rows.map(savedView) };
    },
  );

  app.post(
    "/v1/me/saved-searches",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: createSavedSearchInputSchema,
        response: { 200: savedSearchSchema, 201: savedSearchSchema, ...errors, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { filters, notifyOnNew } = request.body;
      const queryText = request.body.queryText || filters.q || null;
      if (!queryText && Object.keys(filters).every((k) => k === "sort" || k === "q")) {
        throw ApiError.invalid("Add some words or a filter to save a search", {
          filters: "validation.search.empty",
        });
      }
      // Saving the same search again returns the one that exists.
      const [same] = await db
        .select()
        .from(savedSearches)
        .where(
          and(
            eq(savedSearches.userId, userId),
            sql`${savedSearches.queryText} is not distinct from ${queryText}`,
            sql`${savedSearches.filters} = ${JSON.stringify(filters)}::jsonb`,
          ),
        )
        .limit(1);
      if (same) return savedView(same);
      const [{ n } = { n: 0 }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(savedSearches)
        .where(eq(savedSearches.userId, userId));
      if (n >= SAVED_SEARCH_MAX) {
        throw ApiError.conflict("You can save up to 50 searches. Delete one first");
      }
      const [row] = await db
        .insert(savedSearches)
        .values({ userId, queryText, filters, notifyOnNew })
        .returning();
      reply.code(201);
      return savedView(row as typeof savedSearches.$inferSelect);
    },
  );

  app.patch(
    "/v1/me/saved-searches/:id",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: updateSavedSearchInputSchema,
        response: { 200: savedSearchSchema, ...errors },
      },
    },
    async (request) => {
      const [row] = await db
        .update(savedSearches)
        .set({ notifyOnNew: request.body.notifyOnNew })
        .where(and(eq(savedSearches.id, request.params.id), eq(savedSearches.userId, userIdOf(request))))
        .returning();
      if (!row) throw ApiError.notFound();
      return savedView(row);
    },
  );

  app.delete(
    "/v1/me/saved-searches/:id",
    { preHandler, config: WRITE_LIMIT, schema: { params: idParams, response: { 204: z.null(), ...errors } } },
    async (request, reply) => {
      const removed = await db
        .delete(savedSearches)
        .where(and(eq(savedSearches.id, request.params.id), eq(savedSearches.userId, userIdOf(request))))
        .returning({ id: savedSearches.id });
      if (removed.length === 0) throw ApiError.notFound();
      return reply.code(204).send(null);
    },
  );

  // ---- Recent searches ----

  app.get(
    "/v1/me/recent-searches",
    { preHandler, schema: { response: { 200: recentSearchListSchema, 401: errorResponseSchema } } },
    async (request) => {
      const rows = await db
        .select()
        .from(recentSearches)
        .where(eq(recentSearches.userId, userIdOf(request)))
        .orderBy(desc(recentSearches.createdAt), desc(recentSearches.id))
        .limit(RECENT_SEARCHES_MAX);
      return {
        items: rows.map((r) => {
          const filters = searchFiltersSchema.safeParse(r.filters);
          return {
            id: r.id,
            queryText: r.queryText,
            filters: filters.success ? filters.data : searchFiltersSchema.parse({}),
            resultCount: r.resultCount,
            createdAt: r.createdAt.toISOString(),
          };
        }),
      };
    },
  );

  app.post(
    "/v1/me/recent-searches",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { body: createRecentSearchInputSchema, response: { 204: z.null(), ...errors } },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { queryText, filters, resultCount } = request.body;
      await db.transaction(async (tx) => {
        // The same search again moves to the top: remove the old row and write a new one.
        await tx
          .delete(recentSearches)
          .where(
            and(
              eq(recentSearches.userId, userId),
              sql`lower(${recentSearches.queryText}) = lower(${queryText})`,
              sql`${recentSearches.filters} = ${JSON.stringify(filters)}::jsonb`,
            ),
          );
        await tx
          .insert(recentSearches)
          .values({ userId, queryText, filters, resultCount: resultCount ?? null });
        // Keep the 10 newest.
        const keep = await tx
          .select({ id: recentSearches.id })
          .from(recentSearches)
          .where(eq(recentSearches.userId, userId))
          .orderBy(desc(recentSearches.createdAt), desc(recentSearches.id))
          .limit(RECENT_SEARCHES_MAX);
        await tx.delete(recentSearches).where(
          and(
            eq(recentSearches.userId, userId),
            notInArray(
              recentSearches.id,
              keep.map((k) => k.id),
            ),
          ),
        );
      });
      return reply.code(204).send(null);
    },
  );

  app.delete(
    "/v1/me/recent-searches",
    { preHandler, config: WRITE_LIMIT, schema: { response: { 204: z.null(), 401: errorResponseSchema } } },
    async (request, reply) => {
      await db.delete(recentSearches).where(eq(recentSearches.userId, userIdOf(request)));
      return reply.code(204).send(null);
    },
  );

  // ---- Reports ----

  app.post(
    "/v1/reports",
    {
      preHandler,
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
      schema: {
        body: createReportInputSchema,
        response: { 204: z.null(), ...errors, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { targetType, targetId, reason, details } = request.body;
      const own = () => ApiError.invalid("You cannot report yourself", { targetId: "validation.report.own" });

      if (targetType === "listing") {
        const [row] = await db
          .select({ sellerId: listings.sellerId, status: listings.status })
          .from(listings)
          .where(eq(listings.id, targetId))
          .limit(1);
        if (!row || row.status === "draft" || row.status === "removed") throw ApiError.notFound();
        if (row.sellerId === userId) throw own();
      } else if (targetType === "user") {
        const [row] = await db
          .select({ id: profiles.userId })
          .from(profiles)
          .where(and(eq(profiles.userId, targetId), sql`${profiles.deletedAt} is null`))
          .limit(1);
        if (!row) throw ApiError.notFound();
        if (row.id === userId) throw own();
      } else if (targetType === "message") {
        // Only someone in the conversation can report one of its messages, and not their own.
        const [row] = await db
          .select({
            senderId: messages.senderId,
            buyerId: conversations.buyerId,
            sellerId: conversations.sellerId,
          })
          .from(messages)
          .innerJoin(conversations, eq(conversations.id, messages.conversationId))
          .where(eq(messages.id, targetId))
          .limit(1);
        if (!row || (row.buyerId !== userId && row.sellerId !== userId)) throw ApiError.notFound();
        if (row.senderId === userId) throw own();
      } else {
        // A review can be reported by the person it is about.
        const [row] = await db
          .select({ revieweeId: reviews.revieweeId })
          .from(reviews)
          .where(eq(reviews.id, targetId))
          .limit(1);
        if (!row || row.revieweeId !== userId) throw ApiError.notFound();
      }

      // One open report per person and target. Sending it again changes nothing.
      const [open] = await db
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            eq(reports.reporterId, userId),
            eq(reports.targetType, targetType),
            eq(reports.targetId, targetId),
            inArray(reports.status, ["open", "reviewing"]),
          ),
        )
        .limit(1);
      if (!open) {
        await db
          .insert(reports)
          .values({ reporterId: userId, targetType, targetId, reason, details: details || null });
      }
      return reply.code(204).send(null);
    },
  );

  // ---- Personalisation ----

  app.get(
    "/v1/me/personalisation/sizes",
    { preHandler, schema: { response: { 200: personalisationSizesSchema, 401: errorResponseSchema } } },
    async (request) => {
      const rows = await db
        .select({ id: userSizes.sizeId })
        .from(userSizes)
        .where(eq(userSizes.userId, userIdOf(request)));
      return { sizeIds: rows.map((r) => r.id) };
    },
  );

  app.put(
    "/v1/me/personalisation/sizes",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: personalisationSizesSchema,
        response: { 200: personalisationSizesSchema, 400: errorResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const sizeIds = [...new Set(request.body.sizeIds)];
      if (sizeIds.length > 0) {
        const found = await db.select({ id: sizes.id }).from(sizes).where(inArray(sizes.id, sizeIds));
        if (found.length !== sizeIds.length) {
          throw ApiError.invalid("Some sizes do not exist", { sizeIds: "validation.sizes.invalid" });
        }
      }
      await db.transaction(async (tx) => {
        await tx.delete(userSizes).where(eq(userSizes.userId, userId));
        if (sizeIds.length > 0)
          await tx.insert(userSizes).values(sizeIds.map((sizeId) => ({ userId, sizeId })));
      });
      return { sizeIds };
    },
  );
};

export default engagementRoutes;
