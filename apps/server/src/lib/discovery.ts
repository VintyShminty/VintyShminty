import {
  blocks,
  type Database,
  favourites,
  listingColours,
  listingPhotos,
  listings,
  profiles,
  userSizes,
  users,
} from "@vinty/db";
import {
  type CategoryNode,
  DEFAULT_CURRENCY,
  type FeedMood,
  findCategory,
  type ListingCard,
  type ReferenceData,
  SEARCH_TOTAL_CAP,
  type SearchFilters,
  UNDER_50_MINOR,
  type UserSummary,
} from "@vinty/shared";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { awayNowSql } from "./away.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import { buyerPrice, type ListingRow, toCardPhoto } from "./listings.js";

type Db = NonNullable<Database["db"]>;

/** Listings a buyer can see in the feed and in search. Sold ones are only reachable from Favourites and profiles. */
export const BROWSABLE_STATUSES = ["active", "reserved"] as const;

/** One "looks newer" step of the personalised feed: every match makes an item look this much newer. */
export const FEED_BOOST_MS = 6 * 60 * 60 * 1000;

const MAX_TOKENS = 8;

/** Seconds since 1970 in milliseconds. The whole sort key lives in the database, so no precision is lost. */
const bumpedMs = sql`(extract(epoch from ${listings.bumpedAt}) * 1000)::bigint`;

/** Everything a listing needs to leave out for this viewer: holiday sellers, closed accounts, blocked people. */
export function visibilityConditions(viewerId: string | undefined): SQL[] {
  const conditions: SQL[] = [
    sql`not exists (select 1 from ${profiles} where ${profiles.userId} = ${listings.sellerId} and (${awayNowSql} or ${profiles.deletedAt} is not null))`,
  ];
  if (viewerId) {
    conditions.push(
      sql`not exists (select 1 from ${blocks} where (${blocks.blockerId} = ${viewerId} and ${blocks.blockedId} = ${listings.sellerId}) or (${blocks.blockerId} = ${listings.sellerId} and ${blocks.blockedId} = ${viewerId}))`,
    );
  }
  return conditions;
}

/** The category and everything below it. Empty when the id is not in the tree. */
export function categorySubtreeIds(tree: readonly CategoryNode[], categoryId: string): string[] {
  const root = findCategory(tree, categoryId);
  if (!root) return [];
  const ids: string[] = [];
  const walk = (node: CategoryNode) => {
    ids.push(node.id);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return ids;
}

/** Words of the search text: letters and digits only (Hebrew and English), so they are safe in a tsquery. */
export function searchTokens(q: string | undefined): string[] {
  if (!q) return [];
  const clean = q.normalize("NFKC").toLowerCase().replace(/\p{M}/gu, "");
  return (clean.match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TOKENS);
}

export const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Each word must match: as the start of a word (full text) or anywhere in the title or brand (plain substring). */
function textConditions(tokens: string[]): SQL[] {
  return tokens.map((token) => {
    const like = `%${likeEscape(token)}%`;
    return sql`(${listings.searchVector} @@ to_tsquery('simple', ${`${token}:*`}) or ${listings.title} ilike ${like} or coalesce(${listings.brandName}, '') ilike ${like})`;
  });
}

type Filters = Omit<SearchFilters, "sort" | "q"> & { sort?: SearchFilters["sort"]; q?: string };

/** The filters the person set (category, brand, size, price, text and so on). No visibility rules. */
export function filterConditions(filters: Filters, reference: Pick<ReferenceData, "categories">): SQL[] {
  const conditions: SQL[] = [];
  if (filters.categoryId) {
    const ids = categorySubtreeIds(reference.categories, filters.categoryId);
    conditions.push(ids.length > 0 ? inArray(listings.categoryId, ids) : sql`false`);
  }
  if (filters.brandIds?.length) conditions.push(inArray(listings.brandId, filters.brandIds));
  if (filters.sizeIds?.length) conditions.push(inArray(listings.sizeId, filters.sizeIds));
  if (filters.conditionIds?.length) conditions.push(inArray(listings.conditionId, filters.conditionIds));
  if (filters.materialIds?.length) conditions.push(inArray(listings.materialId, filters.materialIds));
  if (filters.patternIds?.length) conditions.push(inArray(listings.patternId, filters.patternIds));
  if (filters.colourIds?.length) {
    conditions.push(
      sql`exists (select 1 from ${listingColours} where ${listingColours.listingId} = ${listings.id} and ${inArray(listingColours.colourId, filters.colourIds)})`,
    );
  }
  if (filters.priceMinMinor !== undefined)
    conditions.push(sql`${listings.priceMinor} >= ${filters.priceMinMinor}`);
  if (filters.priceMaxMinor !== undefined)
    conditions.push(sql`${listings.priceMinor} <= ${filters.priceMaxMinor}`);
  if (filters.sellerId) conditions.push(eq(listings.sellerId, filters.sellerId));
  if (filters.categoryIds?.length) {
    const ids = [
      ...new Set(filters.categoryIds.flatMap((id) => categorySubtreeIds(reference.categories, id))),
    ];
    conditions.push(ids.length > 0 ? inArray(listings.categoryId, ids) : sql`false`);
  }
  conditions.push(...textConditions(searchTokens(filters.q)));
  return conditions;
}

/** The WHERE of search and catalog: live listings, visibility for this viewer, then the filters. */
export function searchConditions(
  filters: Filters,
  reference: Pick<ReferenceData, "categories">,
  viewerId: string | undefined,
): SQL[] {
  return [
    inArray(listings.status, [...BROWSABLE_STATUSES]),
    ...visibilityConditions(viewerId),
    ...filterConditions(filters, reference),
  ];
}

export type SortSpec = { key: SQL; dir: "asc" | "desc" };

/**
 * The sort of a search. Every sort is one number per row plus the id, so a cursor is just `{ k, i }`.
 * Relevance packs the text score above the recency: score * 1e13 + bumped time in ms (a score is at most about 1000).
 */
export function sortSpec(sort: SearchFilters["sort"], q: string | undefined): SortSpec {
  if (sort === "price_asc") return { key: sql`coalesce(${listings.priceMinor}, 0)::bigint`, dir: "asc" };
  if (sort === "price_desc") return { key: sql`coalesce(${listings.priceMinor}, 0)::bigint`, dir: "desc" };
  const tokens = searchTokens(q);
  if (sort === "relevance" && tokens.length > 0) {
    const query = tokens.map((t) => `${t}:*`).join(" & ");
    const titleHit = tokens.map((t) => sql`${listings.title} ilike ${`%${likeEscape(t)}%`}`);
    const allInTitle = sql.join(titleHit, sql` and `);
    return {
      key: sql`(floor(ts_rank(${listings.searchVector}, to_tsquery('simple', ${query})) * 1000)::bigint + (case when ${allInTitle} then 300 else 0 end)) * 10000000000000 + ${bumpedMs}`,
      dir: "desc",
    };
  }
  return { key: bumpedMs, dir: "desc" };
}

export type CardRow = {
  listing: ListingRow;
  coverKey: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  coverPlaceholder: string | null;
  coverCardKey: string | null;
  sortKey: string | null;
};

/** `k` is kept as text: a relevance key can be larger than a JavaScript number holds exactly. */
type CursorShape = { k: string; i: string };

/** Runs a keyset page: rows in sort order, one extra row tells whether there is a next page. */
export async function queryCardRows(
  db: Db,
  opts: { where: SQL[]; sort: SortSpec; cursor: string | undefined; limit: number },
): Promise<{ rows: CardRow[]; nextCursor: string | null }> {
  const { sort, limit } = opts;
  const cursor = decodeCursor<CursorShape>(opts.cursor);
  const valid =
    cursor &&
    /^-?\d{1,19}$/.test(String(cursor.k)) &&
    typeof cursor.i === "string" &&
    /^[0-9a-f-]{36}$/i.test(cursor.i);
  const where = [...opts.where];
  if (valid) {
    const cmp = sort.dir === "desc" ? sql`<` : sql`>`;
    where.push(sql`(${sort.key}, ${listings.id}) ${cmp} (${String(cursor.k)}::bigint, ${cursor.i}::uuid)`);
  }
  const order =
    sort.dir === "desc"
      ? sql`${sort.key} desc, ${listings.id} desc`
      : sql`${sort.key} asc, ${listings.id} asc`;
  const rows = await db
    .select({
      listing: listings,
      coverKey: listingPhotos.objectKey,
      coverWidth: listingPhotos.width,
      coverHeight: listingPhotos.height,
      coverPlaceholder: listingPhotos.placeholder,
      coverCardKey: listingPhotos.cardObjectKey,
      sortKey: sql<string>`(${sort.key})::text`,
    })
    .from(listings)
    .leftJoin(listingPhotos, and(eq(listingPhotos.listingId, listings.id), eq(listingPhotos.position, 0)))
    .where(and(...where))
    .orderBy(order)
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor:
      rows.length > limit && last?.sortKey != null
        ? encodeCursor({ k: last.sortKey, i: last.listing.id })
        : null,
  };
}

/** How many listings match, counted up to 500 (the app shows "500+"). */
export async function countMatches(db: Db, where: SQL[]): Promise<{ total: number; totalCapped: boolean }> {
  const rows = await db
    .select({ one: sql<number>`1` })
    .from(listings)
    .where(and(...where))
    .limit(SEARCH_TOTAL_CAP + 1);
  return { total: Math.min(rows.length, SEARCH_TOTAL_CAP), totalCapped: rows.length > SEARCH_TOTAL_CAP };
}

/** Which of these listings the viewer has hearted. */
export async function favouritedIds(db: Db, viewerId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await db
    .select({ id: favourites.listingId })
    .from(favourites)
    .where(and(eq(favourites.userId, viewerId), inArray(favourites.listingId, listingIds)));
  return new Set(rows.map((r) => r.id));
}

/** Seller summaries (name, photo, rating) for a set of cards, in one query. */
export async function loadSellerSummaries(
  { db, storage }: Pick<FastifyInstance, "db" | "storage">,
  sellerIds: string[],
): Promise<Map<string, UserSummary>> {
  const result = new Map<string, UserSummary>();
  if (sellerIds.length === 0) return result;
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
    .where(inArray(users.id, sellerIds));
  for (const r of rows) {
    result.set(r.id, {
      id: r.id,
      username: r.displayUsername ?? r.username,
      avatarUrl: r.avatarKey ? storage.publicUrl(r.avatarKey) : null,
      ratingAverage: r.count > 0 ? Math.round((r.sum / r.count) * 100) / 100 : null,
      reviewCount: r.count,
    });
  }
  return result;
}

/** Turns query rows into the cards the app draws. `isFavourited` is only present for a signed in viewer. */
export async function toCards(
  app: Pick<FastifyInstance, "db" | "storage">,
  reference: ReferenceData,
  rows: CardRow[],
  opts: { viewerId?: string | undefined; withSeller?: boolean } = {},
): Promise<ListingCard[]> {
  const { db, storage } = app;
  const sizeLabels = new Map<string, string>();
  for (const group of reference.sizeGroups) for (const s of group.sizes) sizeLabels.set(s.id, s.label);
  const conditionSlugs = new Map(reference.conditions.map((c) => [c.id, c.slug]));
  const [hearted, sellers] = await Promise.all([
    opts.viewerId
      ? favouritedIds(
          db,
          opts.viewerId,
          rows.map((r) => r.listing.id),
        )
      : null,
    opts.withSeller ? loadSellerSummaries(app, [...new Set(rows.map((r) => r.listing.sellerId))]) : null,
  ]);
  const now = new Date();
  return rows.map(({ listing: l, coverKey, coverWidth, coverHeight, coverPlaceholder, coverCardKey }) => {
    const price = l.priceMinor ?? 0;
    const seller = sellers?.get(l.sellerId);
    return {
      id: l.id,
      status: l.status,
      title: l.title,
      brandName: l.brandName,
      brandId: l.brandId,
      categoryId: l.categoryId,
      sizeLabel: l.sizeId ? (sizeLabels.get(l.sizeId) ?? null) : null,
      conditionSlug: l.conditionId ? (conditionSlugs.get(l.conditionId) ?? null) : null,
      priceMinor: price,
      buyerPriceMinor: buyerPrice(reference, price, l.currency) ?? price,
      previousPriceMinor: l.previousPriceMinor,
      currency: l.currency,
      cover:
        coverKey && coverWidth && coverHeight
          ? toCardPhoto(storage, {
              objectKey: coverKey,
              width: coverWidth,
              height: coverHeight,
              placeholder: coverPlaceholder,
              cardObjectKey: coverCardKey,
            })
          : null,
      favouriteCount: l.favouriteCount,
      ...(hearted ? { isFavourited: hearted.has(l.id) } : {}),
      isBumped: Boolean(l.bumpedUntil && l.bumpedUntil > now),
      ...(seller ? { seller } : {}),
    };
  });
}

/**
 * The extra WHERE of a mood chip on Home. `viewer` is what the chip needs to know about the person: their sizes and
 * city. A chip that needs something the person has not set (no sizes, no city, not signed in) matches nothing.
 */
export async function moodConditions(
  db: Db,
  mood: FeedMood | undefined,
  viewerId: string | undefined,
): Promise<SQL[]> {
  if (!mood || mood === "for_you") return [];
  if (mood === "new_today") {
    return [sql`${listings.publishedAt} > now() - interval '24 hours'`];
  }
  if (mood === "under_50") {
    return [sql`${listings.currency} = ${DEFAULT_CURRENCY}`, sql`${listings.priceMinor} < ${UNDER_50_MINOR}`];
  }
  if (!viewerId) return [sql`false`];
  if (mood === "your_sizes") {
    return [
      sql`${listings.sizeId} in (select ${userSizes.sizeId} from ${userSizes} where ${userSizes.userId} = ${viewerId})`,
    ];
  }
  const [profile] = await db
    .select({ city: profiles.city })
    .from(profiles)
    .where(eq(profiles.userId, viewerId))
    .limit(1);
  const city = profile?.city?.trim().toLowerCase();
  if (!city) return [sql`false`];
  return [sql`lower(trim(${listings.city})) = ${city}`];
}

/** Trending: hearts count 5, views count 1, then newest first. */
export const trendingSort = (): SortSpec => ({
  key: sql`(least(${listings.favouriteCount} * 5 + ${listings.viewCount}, 900000)::bigint * 10000000000000 + ${bumpedMs})`,
  dir: "desc",
});
