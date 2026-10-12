import { createHash } from "node:crypto";
import { blocks, brands, listings, listingViews, profiles, recentSearches, users } from "@vinty/db";
import {
  categoryTrail,
  errorResponseSchema,
  feedPageSchema,
  feedQuerySchema,
  idSchema,
  type ListingCard,
  listingDetailSchema,
  membersPageSchema,
  membersQuerySchema,
  paginationQuerySchema,
  type Suggestion,
  searchCountSchema,
  searchPageSchema,
  searchQuerySchema,
  suggestionsQuerySchema,
  suggestionsSchema,
} from "@vinty/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import {
  BROWSABLE_STATUSES,
  categorySubtreeIds,
  countMatches,
  FEED_BOOST_MS,
  feedBoost,
  filterConditions,
  likeEscape,
  personalSort,
  queryCardRows,
  searchConditions,
  sortSpec,
  toCards,
  trendingSort,
  visibilityConditions,
} from "../lib/discovery.js";
import { ApiError } from "../lib/errors.js";
import { type ListingRow, loadListingDetail } from "../lib/listings.js";
import { optionalViewerId } from "../lib/viewer.js";

const idParams = z.object({ id: idSchema });
const SEARCH_LIMIT = { rateLimit: { max: 120, timeWindow: "1 minute" } };
const notFound = { 404: errorResponseSchema };

/** Feed, search, suggestions, the item page, similar items and the Members tab (Milestone 3). */
const discoveryRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  // ---- Feed ----

  app.get(
    "/v1/feed",
    { schema: { querystring: feedQuerySchema, response: { 200: feedPageSchema } } },
    async (request) => {
      const viewerId = await optionalViewerId(app, request);
      const reference = await app.reference.get();
      const { categoryId, trending, limit, cursor } = request.query;
      const where = [
        inArray(listings.status, [...BROWSABLE_STATUSES]),
        ...visibilityConditions(viewerId),
        ...filterConditions(categoryId ? { categoryId } : {}, reference),
      ];
      // Your own items are not recommended back to you.
      if (viewerId) where.push(sql`${listings.sellerId} <> ${viewerId}`);
      const sort = trending ? trendingSort() : personalSort(await feedBoost(db, viewerId));
      const { rows, nextCursor } = await queryCardRows(db, { where, sort, cursor, limit });
      return { items: await toCards(app, reference, rows, { viewerId, withSeller: true }), nextCursor };
    },
  );

  // ---- Search and catalog ----

  app.get(
    "/v1/listings",
    { config: SEARCH_LIMIT, schema: { querystring: searchQuerySchema, response: { 200: searchPageSchema } } },
    async (request) => {
      const viewerId = await optionalViewerId(app, request);
      const reference = await app.reference.get();
      const { cursor, limit, sort, ...filters } = request.query;
      const where = searchConditions(filters, reference, viewerId);
      const [page, counts] = await Promise.all([
        queryCardRows(db, { where, sort: sortSpec(sort, filters.q), cursor, limit }),
        countMatches(db, where),
      ]);
      return {
        items: await toCards(app, reference, page.rows, { viewerId, withSeller: true }),
        nextCursor: page.nextCursor,
        ...counts,
      };
    },
  );

  app.get(
    "/v1/listings/count",
    {
      config: SEARCH_LIMIT,
      schema: {
        querystring: searchQuerySchema.omit({ cursor: true, limit: true }),
        response: { 200: searchCountSchema },
      },
    },
    async (request) => {
      const viewerId = await optionalViewerId(app, request);
      const reference = await app.reference.get();
      const { sort: _sort, ...filters } = request.query;
      return countMatches(db, searchConditions(filters, reference, viewerId));
    },
  );

  app.get(
    "/v1/search/suggestions",
    {
      config: SEARCH_LIMIT,
      schema: { querystring: suggestionsQuerySchema, response: { 200: suggestionsSchema } },
    },
    async (request) => {
      const reference = await app.reference.get();
      const text = request.query.q;
      const lower = text.toLowerCase();
      const startsWord = (name: string) =>
        name
          .toLowerCase()
          .split(/\s+/)
          .some((w) => w.startsWith(lower));
      const pattern = likeEscape(lower);

      // Words other people searched for. A phrase counts only after three different people used it.
      const popular = await db
        .select({ text: sql<string>`min(${recentSearches.queryText})` })
        .from(recentSearches)
        .where(sql`lower(${recentSearches.queryText}) like ${`${pattern}%`}`)
        .groupBy(sql`lower(${recentSearches.queryText})`)
        .having(sql`count(distinct ${recentSearches.userId}) >= 3`)
        .orderBy(sql`count(distinct ${recentSearches.userId}) desc`)
        .limit(4);

      const brandRows = await db
        .select({ id: brands.id, name: brands.name })
        .from(brands)
        .where(
          and(
            eq(brands.isActive, true),
            sql`(lower(${brands.name}) like ${`${pattern}%`} or lower(${brands.name}) like ${`% ${pattern}%`})`,
          ),
        )
        .orderBy(
          sql`(lower(${brands.name}) like ${`${pattern}%`}) desc`,
          desc(brands.popularity),
          asc(brands.name),
        )
        .limit(4);

      const categoryHits: Suggestion[] = [];
      const walk = (nodes: typeof reference.categories) => {
        for (const node of nodes) {
          const lang = (["en", "he"] as const).find((l) => startsWord(node.name[l]));
          if (lang && categoryHits.length < 4) {
            categoryHits.push({
              text: node.name[lang],
              kind: "category",
              categoryId: node.id,
              categoryName: node.name,
            });
          }
          walk(node.children);
        }
      };
      walk(reference.categories);

      const suggestions: Suggestion[] = [
        ...popular.map((p): Suggestion => ({ text: p.text, kind: "query" })),
        ...brandRows.map((b): Suggestion => ({ text: b.name, kind: "brand", brandId: b.id })),
        ...categoryHits,
      ];
      const seen = new Set<string>();
      const unique = suggestions.filter((s) => {
        const key = `${s.kind}:${s.text.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { suggestions: unique.slice(0, 10) };
    },
  );

  // ---- Item page ----

  /**
   * A listing this viewer may open. Drafts, hidden and removed ones are the owner's only (and removed is nobody's),
   * and someone who blocked you, or whom you blocked, looks exactly like a listing that does not exist.
   */
  async function openableListing(id: string, viewerId: string | undefined): Promise<ListingRow> {
    const [row] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!row || row.status === "removed") throw ApiError.notFound();
    const isOwner = viewerId === row.sellerId;
    if (!isOwner && (row.status === "draft" || row.status === "hidden")) throw ApiError.notFound();
    if (!isOwner && viewerId) {
      const [blocked] = await db
        .select({ one: sql<number>`1` })
        .from(blocks)
        .where(
          sql`(${blocks.blockerId} = ${viewerId} and ${blocks.blockedId} = ${row.sellerId}) or (${blocks.blockerId} = ${row.sellerId} and ${blocks.blockedId} = ${viewerId})`,
        )
        .limit(1);
      if (blocked) throw ApiError.notFound();
    }
    const [seller] = await db
      .select({ deletedAt: profiles.deletedAt })
      .from(profiles)
      .where(eq(profiles.userId, row.sellerId))
      .limit(1);
    if (!seller || seller.deletedAt) throw ApiError.notFound();
    return row;
  }

  /** Counts one view per viewer per day. Signed in viewers by id, visitors by a hash of their address. */
  async function countView(row: ListingRow, viewerId: string | undefined, ip: string): Promise<boolean> {
    if (viewerId === row.sellerId) return false;
    const viewerKey = viewerId
      ? `u:${viewerId}`
      : `a:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
    const day = new Date().toISOString().slice(0, 10);
    return db.transaction(async (tx) => {
      const inserted = await tx
        .insert(listingViews)
        .values({ listingId: row.id, viewerKey, day })
        .onConflictDoNothing()
        .returning({ day: listingViews.day });
      if (inserted.length === 0) return false;
      // The counter must not look like an edit: keep updated_at as it is.
      await tx
        .update(listings)
        .set({ viewCount: sql`${listings.viewCount} + 1`, updatedAt: sql`${listings.updatedAt}` })
        .where(eq(listings.id, row.id));
      return true;
    });
  }

  app.get(
    "/v1/listings/:id",
    { schema: { params: idParams, response: { 200: listingDetailSchema, ...notFound } } },
    async (request) => {
      const viewerId = await optionalViewerId(app, request);
      const reference = await app.reference.get();
      const row = await openableListing(request.params.id, viewerId);
      const counted = await countView(row, viewerId, request.ip);
      return loadListingDetail(
        app,
        reference,
        counted ? { ...row, viewCount: row.viewCount + 1 } : row,
        viewerId,
      );
    },
  );

  app.get(
    "/v1/listings/:id/similar",
    {
      schema: {
        params: idParams,
        querystring: paginationQuerySchema,
        response: { 200: feedPageSchema, ...notFound },
      },
    },
    async (request) => {
      const viewerId = await optionalViewerId(app, request);
      const reference = await app.reference.get();
      const row = await openableListing(request.params.id, viewerId);
      const { limit, cursor } = request.query;

      // The same category and its siblings (the parent's subtree), other items only.
      const trail = row.categoryId ? categoryTrail(reference.categories, row.categoryId) : [];
      const scope = trail.length > 1 ? trail[trail.length - 2] : trail[0];
      const where = [
        inArray(listings.status, [...BROWSABLE_STATUSES]),
        ...visibilityConditions(viewerId),
        sql`${listings.id} <> ${row.id}`,
        scope ? inArray(listings.categoryId, categorySubtreeIds(reference.categories, scope.id)) : sql`false`,
      ];
      // Closer items look newer: +3 same category, +2 same brand, +1 a price within 40 percent.
      const near = row.priceMinor
        ? sql`(case when ${listings.priceMinor} between ${Math.floor(row.priceMinor * 0.6)} and ${Math.ceil(row.priceMinor * 1.4)} then 1 else 0 end)`
        : sql`0`;
      const sameBrand = row.brandId
        ? sql`(case when ${listings.brandId} = ${row.brandId} then 2 else 0 end)`
        : sql`0`;
      const sameCategory = row.categoryId
        ? sql`(case when ${listings.categoryId} = ${row.categoryId} then 3 else 0 end)`
        : sql`0`;
      const sort = {
        key: sql`((extract(epoch from ${listings.bumpedAt}) * 1000)::bigint + (${sameCategory} + ${sameBrand} + ${near}) * ${FEED_BOOST_MS}::bigint)`,
        dir: "desc" as const,
      };
      const page = await queryCardRows(db, { where, sort, cursor, limit });
      const items: ListingCard[] = await toCards(app, reference, page.rows, { viewerId, withSeller: true });
      return { items, nextCursor: page.nextCursor };
    },
  );

  // ---- Members tab ----

  app.get(
    "/v1/users",
    {
      config: SEARCH_LIMIT,
      schema: { querystring: membersQuerySchema, response: { 200: membersPageSchema } },
    },
    async (request) => {
      const viewerId = await optionalViewerId(app, request);
      const { q, limit } = request.query;
      const offset = decodeCursor<{ o: number }>(request.query.cursor)?.o ?? 0;
      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          displayUsername: users.displayUsername,
          avatarKey: profiles.avatarKey,
          count: profiles.memberReviewCount,
          sum: profiles.memberRatingSum,
        })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(
            sql`lower(${users.username}) like ${`${likeEscape(q.toLowerCase())}%`}`,
            sql`${profiles.deletedAt} is null`,
            viewerId
              ? sql`not exists (select 1 from ${blocks} where (${blocks.blockerId} = ${viewerId} and ${blocks.blockedId} = ${users.id}) or (${blocks.blockerId} = ${users.id} and ${blocks.blockedId} = ${viewerId}))`
              : undefined,
          ),
        )
        .orderBy(asc(users.username), asc(users.id))
        .limit(limit + 1)
        .offset(offset);
      return {
        items: rows.slice(0, limit).map((r) => ({
          id: r.id,
          username: r.displayUsername ?? r.username,
          avatarUrl: r.avatarKey ? app.storage.publicUrl(r.avatarKey) : null,
          ratingAverage: r.count > 0 ? Math.round((r.sum / r.count) * 100) / 100 : null,
          reviewCount: r.count,
        })),
        nextCursor: rows.length > limit ? encodeCursor({ o: offset + limit }) : null,
      };
    },
  );
};

export default discoveryRoutes;
