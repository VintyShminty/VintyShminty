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
import { and, asc, eq, inArray, lt, type SQL, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { awayNowSql } from "./away.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import { buyerPrice, type ListingRow, toCardPhoto } from "./listings.js";
import { categoriesNamedBy } from "./search-rules.js";

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

/**
 * Characters that join the pieces of one word: H&M, Levi's, T-shirt, A.P.C., ג'ינס (the Hebrew geresh and
 * gershayim too), 90/60, C++. A search for any of them is one word, not two or three.
 */
const JOINERS = "&'\u2019\u05f3\u05f4\".\\-/+";
const WORD_RE = new RegExp(`[\\p{L}\\p{N}${JOINERS}]+`, "gu");
const JOINER_RE = new RegExp(`[${JOINERS}]+`, "gu");
const EDGE_JOINER_RE = new RegExp(`^[${JOINERS}]+|[${JOINERS}]+$`, "gu");
/** The same joiners as a Postgres regular expression class (bound as a value, so nothing is escaped twice). */
const SQL_JOINERS = "[&'’׳״\"./+-]";
/** A search word of this length or shorter matches only whole words, never a piece of a longer one. */
const SHORT_WORD = 2;

/**
 * One word of a search. `text` is the word with its joiners taken out ("hm", "levis", "tshirt", "גינס"). `parts` are
 * the pieces around the joiners when there were any (["h", "m"]), so "H&M" also meets a title written "H & M" or a
 * brand saved as "H&M", whose words the text index keeps apart.
 */
export type SearchTerm = { text: string; parts: string[] };

/**
 * The words of a search, letters and digits only (Hebrew and English), so they are safe in a tsquery. Joined words
 * stay one word: "H&M" is "hm", never "h" and "m" (which matched every title with those letters in it).
 */
export function searchTerms(q: string | undefined): SearchTerm[] {
  if (!q) return [];
  const clean = q
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    // Single letters around an ampersand are one name typed with spaces: "h & m" is "h&m".
    .replace(/(?<![\p{L}\p{N}])(\p{L})\s*&\s*(\p{L})(?![\p{L}\p{N}])/gu, "$1&$2");
  const terms: SearchTerm[] = [];
  for (const raw of clean.match(WORD_RE) ?? []) {
    const word = raw.replace(EDGE_JOINER_RE, "");
    if (!word) continue;
    const parts = word.split(JOINER_RE).filter(Boolean);
    const text = parts.join("");
    if (!text) continue;
    terms.push({ text, parts: parts.length > 1 ? parts : [] });
    if (terms.length >= MAX_TOKENS) break;
  }
  return terms;
}

/** The words of a search as plain text ("hm", "dress"), for callers that only need them. */
export function searchTokens(q: string | undefined): string[] {
  return searchTerms(q).map((t) => t.text);
}

export const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The tsquery for one term: a whole word for a short one, the start of a word otherwise, plus the pieces as a phrase. */
export function termQuery(term: SearchTerm): string {
  const short = term.text.length <= SHORT_WORD;
  const alternatives = [short ? term.text : `${term.text}:*`];
  if (term.parts.length > 1) {
    const last = term.parts.length - 1;
    alternatives.push(`(${term.parts.map((p, i) => (i === last && !short ? `${p}:*` : p)).join(" <-> ")})`);
  }
  return alternatives.join(" | ");
}

/** The title and brand lower cased with the joiners taken out, so "Levi's" and "levis" are the same. */
const squashedText = sql`regexp_replace(lower(${listings.title} || ' ' || coalesce(${listings.brandName}, '')), ${SQL_JOINERS}, '', 'g')`;
const squashedBrand = sql`regexp_replace(lower(coalesce(${listings.brandName}, '')), ${`${SQL_JOINERS}|\\s`}, '', 'g')`;

/** What may sit next to a whole word: anything but a Latin or Hebrew letter or a digit. Spelled out, so the database locale does not decide. */
const WORD_EDGE = "[^a-z0-9א-ת]";

/** True when the title or brand has this term: as a whole word when it is short, anywhere in a word otherwise. */
function termInText(term: SearchTerm): SQL {
  if (term.text.length <= SHORT_WORD) {
    // Only letters and digits reach here, so the term is safe inside a regular expression.
    const whole = `(^|${WORD_EDGE})${term.text}($|${WORD_EDGE})`;
    return sql`(${squashedText} ~ ${whole} or ${squashedBrand} = ${term.text})`;
  }
  return sql`${squashedText} like ${`%${likeEscape(term.text)}%`}`;
}

/** True when the title or brand has this term at the start of a word ("גינס" in "ג'ינס", not in "היגינס"). */
function termStartsWord(term: SearchTerm): SQL {
  return sql`${squashedText} ~ ${`(^|${WORD_EDGE})${term.text}`}`;
}

/**
 * Each word must match: as a word in the text index (title, brand and description), in the title or brand, or as the
 * name of the item's category or one above it ("shoes" finds everything under Shoes). A short word (one or two
 * letters, "hm", "xs", "38") only counts as a whole word, a longer one also as a piece of a word ("shirt" in "tshirt",
 * "חולצה" in "בחולצה").
 */
export function textConditions(terms: SearchTerm[], tree: readonly CategoryNode[]): SQL[] {
  return terms.map((term) => {
    // A single letter skips the text index, which keeps "H&M" as "h" and "m": a search for "m" is not a search for H&M.
    const text =
      term.text.length === 1
        ? termInText(term)
        : sql`${listings.searchVector} @@ to_tsquery('simple', ${termQuery(term)}) or ${termInText(term)}`;
    const named = [
      ...new Set(categoriesNamedBy(term.text, tree).flatMap((id) => categorySubtreeIds(tree, id))),
    ];
    return named.length > 0 ? sql`(${text} or ${inArray(listings.categoryId, named)})` : sql`(${text})`;
  });
}

type Filters = Omit<SearchFilters, "sort" | "q"> & { sort?: SearchFilters["sort"]; q?: string };

/** The filters the person set (category, brand, size, price, text and so on). No visibility rules. */
export function filterConditions(
  filters: Filters,
  reference: Pick<ReferenceData, "categories">,
  textBrand?: { id: string; name: string } | null,
): SQL[] {
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
  const text = textConditions(searchTerms(filters.q), reference.categories);
  if (text.length > 0 && textBrand) {
    // The whole search text is a brand (in any spelling or language): its items match even when the words are not in
    // their titles ("מייקל קורס" finds the items listed under Michael Kors).
    conditions.push(
      sql`(${eq(listings.brandId, textBrand.id)} or lower(coalesce(${listings.brandName}, '')) = lower(${textBrand.name}) or (${and(...text)}))`,
    );
  } else {
    conditions.push(...text);
  }
  return conditions;
}

/** The WHERE of search and catalog: live listings, visibility for this viewer, then the filters. */
export function searchConditions(
  filters: Filters,
  reference: Pick<ReferenceData, "categories">,
  viewerId: string | undefined,
  textBrand?: { id: string; name: string } | null,
): SQL[] {
  return [
    inArray(listings.status, [...BROWSABLE_STATUSES]),
    ...visibilityConditions(viewerId),
    ...filterConditions(filters, reference, textBrand),
  ];
}

export type SortSpec = { key: SQL; dir: "asc" | "desc" };

/**
 * What a signed in person's search order leans on (plan section 11.4): other shopping groups (minus the corners they
 * opened), their taste and the sizes they set. Built by `searchPersonal` in feed.ts.
 */
export type SearchPersonal = {
  otherGroupIds: string[];
  cornerIds: string[];
  categoryIds: string[];
  brandIds: string[];
  sellerIds: string[];
  styles: string[];
  sizeIds: string[];
};

/** 0 to 11 points: own group (or a corner they opened) 4, a liked category 2, brand 1, seller 1, style 1, a set size 2. */
function personalPoints(p: SearchPersonal): SQL {
  const when = (condition: SQL | undefined, points: number) =>
    condition ? sql`(case when ${condition} then ${sql.raw(String(points))} else 0 end)` : sql`0`;
  const has = (
    column:
      | typeof listings.categoryId
      | typeof listings.brandId
      | typeof listings.sellerId
      | typeof listings.sizeId,
    ids: string[],
  ) => (ids.length > 0 ? inArray(column, ids) : undefined);
  const otherGroup = has(listings.categoryId, p.otherGroupIds);
  const corner = has(listings.categoryId, p.cornerIds);
  const ownGroup = otherGroup
    ? sql`not coalesce(${otherGroup}${corner ? sql` and not ${corner}` : sql``}, false)`
    : sql`true`;
  const style =
    p.styles.length > 0
      ? sql`${listings.styles} && array[${sql.join(
          p.styles.map((st) => sql`${st}`),
          sql`, `,
        )}]::listing_style[]`
      : undefined;
  return sql`(${when(ownGroup, 4)} + ${when(has(listings.categoryId, p.categoryIds), 2)} + ${when(has(listings.brandId, p.brandIds), 1)} + ${when(has(listings.sellerId, p.sellerIds), 1)} + ${when(style, 1)} + ${when(has(listings.sizeId, p.sizeIds), 2)})::bigint`;
}

/**
 * The sort of a search. Every sort is one number per row plus the id, so a cursor is just `{ k, i }`.
 * Relevance packs the text score above the recency: score * 1e13 + bumped time in ms (a score is at most about 1000).
 */
export function sortSpec(
  sort: SearchFilters["sort"],
  q: string | undefined,
  personal: SearchPersonal | null = null,
): SortSpec {
  if (sort === "price_asc") return { key: sql`coalesce(${listings.priceMinor}, 0)::bigint`, dir: "asc" };
  if (sort === "price_desc") return { key: sql`coalesce(${listings.priceMinor}, 0)::bigint`, dir: "desc" };
  const terms = searchTerms(q);
  if (sort === "relevance" && terms.length > 0) {
    const query = terms.map((t) => `(${termQuery(t)})`).join(" & ");
    // Title and brand first: every word at the start of a word beats every word buried inside one.
    const allStartWords = sql.join(terms.map(termStartsWord), sql` and `);
    const allInTitle = sql.join(terms.map(termInText), sql` and `);
    const text = sql`(floor(ts_rank(${listings.searchVector}, to_tsquery('simple', ${query})) * 1000)::bigint + (case when ${allStartWords} then 300 when ${allInTitle} then 150 else 0 end))`;
    if (personal) {
      // The text match still comes first, in steps of 50 so items that match about as well count as equal. Inside a
      // step the person decides (0 to 11 points), then recency: step * 1e15 + points * 1e13 + bumped time in ms.
      return {
        key: sql`(${text} / 50) * 1000000000000000 + ${personalPoints(personal)} * 10000000000000 + ${bumpedMs}`,
        dir: "desc",
      };
    }
    return { key: sql`${text} * 10000000000000 + ${bumpedMs}`, dir: "desc" };
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

/** The first few photos of each listing, in order, for the arrows on the website card. One query for all ids. */
const CARD_PHOTO_LIMIT = 5;
async function loadCardPhotos(db: Db, listingIds: string[]) {
  const result = new Map<
    string,
    {
      objectKey: string;
      width: number;
      height: number;
      placeholder: string | null;
      cardObjectKey: string | null;
    }[]
  >();
  if (listingIds.length === 0) return result;
  const rows = await db
    .select({
      listingId: listingPhotos.listingId,
      objectKey: listingPhotos.objectKey,
      width: listingPhotos.width,
      height: listingPhotos.height,
      placeholder: listingPhotos.placeholder,
      cardObjectKey: listingPhotos.cardObjectKey,
    })
    .from(listingPhotos)
    .where(and(inArray(listingPhotos.listingId, listingIds), lt(listingPhotos.position, CARD_PHOTO_LIMIT)))
    .orderBy(asc(listingPhotos.position));
  for (const r of rows) {
    const list = result.get(r.listingId);
    if (list) list.push(r);
    else result.set(r.listingId, [r]);
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
  const [hearted, sellers, extraPhotos] = await Promise.all([
    opts.viewerId
      ? favouritedIds(
          db,
          opts.viewerId,
          rows.map((r) => r.listing.id),
        )
      : null,
    opts.withSeller ? loadSellerSummaries(app, [...new Set(rows.map((r) => r.listing.sellerId))]) : null,
    loadCardPhotos(
      db,
      rows.map((r) => r.listing.id),
    ),
  ]);
  const now = new Date();
  return rows.map(({ listing: l, coverKey, coverWidth, coverHeight, coverPlaceholder, coverCardKey }) => {
    const price = l.priceMinor ?? 0;
    const seller = sellers?.get(l.sellerId);
    const photoRows = extraPhotos.get(l.id);
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
      ...(photoRows && photoRows.length >= 2
        ? {
            photos: photoRows.map((p) =>
              toCardPhoto(storage, {
                objectKey: p.objectKey,
                width: p.width,
                height: p.height,
                placeholder: p.placeholder,
                cardObjectKey: p.cardObjectKey,
              }),
            ),
          }
        : {}),
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
