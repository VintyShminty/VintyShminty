import { createHash } from "node:crypto";
import {
  feedHidden,
  feedSnapshots,
  follows,
  listingColours,
  listingPopularity7d,
  listings,
  userAffinities,
  userBrands,
  userEvents,
  userSizes,
  users,
} from "@vinty/db";
import {
  AFFINITY_FEATURES,
  type AffinityFeature,
  arrangeFeed,
  type CategoryNode,
  confidence,
  effectiveScore,
  type FeedCard,
  type FeedMood,
  type FeedReason,
  type FeedReasonKind,
  FIRST_CHANCE_HOURS,
  FIRST_CHANCE_MAX_VIEWS,
  FRESHNESS_HOURS,
  findCategory,
  GENERAL_WEIGHTS,
  type HomeFeedPage,
  NEW_PILE_DAYS,
  PERSONAL_WEIGHTS,
  PILES,
  priceBand,
  type ReferenceData,
  type ScoredItem,
  SEEN_PENALTY,
  SEEN_PENALTY_AFTER,
  SHUFFLE_SIZE,
  SNAPSHOT_SIZE,
  SNAPSHOT_TTL_MS,
} from "@vinty/shared";
import { and, desc, eq, inArray, isNull, notInArray, or, type SQL, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { decodeCursor, encodeCursor } from "./cursor.js";
import {
  BROWSABLE_STATUSES,
  categorySubtreeIds,
  filterConditions,
  moodConditions,
  queryCardRows,
  toCards,
  visibilityConditions,
} from "./discovery.js";
import { parentCategoryIds, personalisationOn } from "./events.js";

type App = Pick<FastifyInstance, "db" | "storage" | "reference" | "log">;

const HOUR_MS = 3_600_000;
/** A term has to add at least this much to the score to be named as the reason. */
const REASON_MIN = 0.2;
/** The taste pile looks at this many of the person's top lines. */
const TOP_CATEGORIES = 5;
const TOP_PARENTS = 2;
const TOP_BRANDS = 5;
const TOP_SELLERS = 3;

// ---- The taste profile ----

export type Taste = {
  confidence: number;
  /** Per feature, key to a value from 0 to 1 (the score divided by the person's best score of that feature). */
  scores: Record<AffinityFeature, Map<string, number>>;
  top: { categories: string[]; parents: string[]; brands: string[]; sellers: string[] };
  /** Categories the person already knows well. The surprise pile looks elsewhere. */
  knownCategories: string[];
  follows: Set<string>;
  pickedBrands: Set<string>;
  chosenSizes: Set<string>;
  /** Listing id to how often it was shown in the last 7 days and how often it was opened. */
  seen: Map<string, { shown: number; opened: number }>;
};

/** The fading taste lines of one person, as values from 0 to 1 plus the confidence. Pure, so it can be tested. */
export function buildTaste(
  lines: { feature: AffinityFeature; key: string; score: number; scoredAt: Date }[],
  rootCategoryIds: ReadonlySet<string>,
  now = new Date(),
): Pick<Taste, "confidence" | "scores" | "top" | "knownCategories"> {
  const effective = lines
    .map((l) => ({ ...l, eff: effectiveScore(l.score, l.scoredAt, now) }))
    .filter((l) => l.eff > 0);
  const scores = Object.fromEntries(AFFINITY_FEATURES.map((f) => [f, new Map<string, number>()])) as Record<
    AffinityFeature,
    Map<string, number>
  >;
  const sorted = (feature: AffinityFeature) =>
    effective.filter((l) => l.feature === feature).sort((a, b) => b.eff - a.eff);
  for (const feature of AFFINITY_FEATURES) {
    const rows = sorted(feature);
    const best = rows[0]?.eff ?? 0;
    for (const r of rows) scores[feature].set(r.key, best > 0 ? r.eff / best : 0);
  }
  const sum = (rows: { eff: number }[]) => rows.reduce((n, r) => n + r.eff, 0);
  const categoryTotal = sum(sorted("category"));
  const rootTotal = sum(sorted("parent_category").filter((r) => rootCategoryIds.has(r.key)));
  return {
    confidence: confidence(Math.max(categoryTotal, rootTotal)),
    scores,
    top: {
      categories: sorted("category")
        .slice(0, TOP_CATEGORIES)
        .map((r) => r.key),
      parents: sorted("parent_category")
        .slice(0, TOP_PARENTS)
        .map((r) => r.key),
      brands: sorted("brand")
        .slice(0, TOP_BRANDS)
        .map((r) => r.key),
      sellers: sorted("seller")
        .slice(0, TOP_SELLERS)
        .map((r) => r.key),
    },
    knownCategories: sorted("category")
      .filter((r) => r.eff >= 1)
      .map((r) => r.key),
  };
}

/** Null for a visitor and for a person who turned personalisation off: they get the general score only. */
async function loadTaste(
  app: App,
  viewerId: string | undefined,
  reference: ReferenceData,
): Promise<Taste | null> {
  if (!viewerId || !(await personalisationOn(app, viewerId))) return null;
  const { db } = app;
  const [lines, followed, brandRows, sizeRows, seenRows] = await Promise.all([
    db.select().from(userAffinities).where(eq(userAffinities.userId, viewerId)),
    db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewerId)),
    db.select({ id: userBrands.brandId }).from(userBrands).where(eq(userBrands.userId, viewerId)),
    db.select({ id: userSizes.sizeId }).from(userSizes).where(eq(userSizes.userId, viewerId)),
    db
      .select({
        listingId: userEvents.listingId,
        shown: sql<number>`count(*) filter (where ${userEvents.type} = 'impression')::int`,
        opened: sql<number>`count(*) filter (where ${userEvents.type} in ('listing_open', 'listing_open_repeat', 'listing_dwell'))::int`,
      })
      .from(userEvents)
      .where(
        and(
          eq(userEvents.userId, viewerId),
          sql`${userEvents.occurredAt} > now() - interval '7 days'`,
          sql`${userEvents.listingId} is not null`,
        ),
      )
      .groupBy(userEvents.listingId),
  ]);
  const roots = new Set(reference.categories.map((c) => c.id));
  const base = buildTaste(
    lines.map((l) => ({ feature: l.feature, key: l.featureKey, score: l.score, scoredAt: l.scoredAt })),
    roots,
  );
  return {
    ...base,
    follows: new Set(followed.map((f) => f.id)),
    pickedBrands: new Set(brandRows.map((b) => b.id)),
    chosenSizes: new Set(sizeRows.map((s) => s.id)),
    seen: new Map(
      seenRows.flatMap((r) =>
        r.listingId ? [[r.listingId, { shown: r.shown, opened: r.opened }] as const] : [],
      ),
    ),
  };
}

// ---- Scoring ----

export type Candidate = {
  id: string;
  sellerId: string;
  categoryId: string | null;
  brandId: string | null;
  brandName: string | null;
  sizeId: string | null;
  conditionId: string | null;
  priceBand: number | null;
  priceMinor: number | null;
  previousPriceMinor: number | null;
  bumpedAt: Date;
  bumpedUntil: Date | null;
  publishedAt: Date | null;
  viewCount: number;
  pop: number;
  colourIds: string[];
  /** Style tags (D-042). Only used for scoring, never shown. */
  styles: string[];
  explore: boolean;
};

type ReasonRef = { type: "category" | "brand" | "seller"; id: string } | null;
export type Term = { value: number; kind: FeedReasonKind; ref: ReasonRef };

export type ScoreContext = {
  now: Date;
  /** Stays the same all day for one person, so the small shuffle does not move cards between requests. */
  seed: string;
  maxPop: number;
  parentsOf: (categoryId: string) => readonly string[];
};

const shuffleOf = (seed: string, id: string) =>
  (createHash("md5").update(`${seed}|${id}`).digest().readUInt32BE(0) / 0xffffffff) * SHUFFLE_SIZE;

/**
 * The score of section 3.1 of the plan. `score = confidence * learned + chosen on purpose + general - penalty + shuffle`.
 * What the person chose on purpose (a followed seller, a picked brand, a size) counts in full from the first day, as the
 * old feed did. Only what the feed learned from behaviour is scaled by the confidence.
 */
export function scoreCandidate(
  c: Candidate,
  taste: Taste | null,
  ctx: ScoreContext,
): { score: number; terms: Term[] } {
  const terms: Term[] = [];
  const add = (value: number, kind: FeedReasonKind, ref: ReasonRef = null) => {
    if (value > 0) terms.push({ value, kind, ref });
    return value;
  };
  let personal = 0;
  let chosen = 0;
  let penalty = 0;
  if (taste) {
    const conf = taste.confidence;
    const s = taste.scores;
    const get = (feature: AffinityFeature, key: string | null) => (key ? (s[feature].get(key) ?? 0) : 0);
    const W = PERSONAL_WEIGHTS;

    personal += add(
      conf * W.category * get("category", c.categoryId),
      "like_category",
      c.categoryId ? { type: "category", id: c.categoryId } : null,
    );
    let parentBest = 0;
    let parentId: string | null = null;
    for (const id of c.categoryId ? ctx.parentsOf(c.categoryId) : []) {
      const v = get("parent_category", id);
      if (v > parentBest) {
        parentBest = v;
        parentId = id;
      }
    }
    personal += add(
      conf * W.parentCategory * parentBest,
      "like_category",
      parentId ? { type: "category", id: parentId } : null,
    );
    personal += add(
      conf * W.brand * get("brand", c.brandId),
      "like_brand",
      c.brandId ? { type: "brand", id: c.brandId } : null,
    );
    personal += add(conf * W.seller * get("seller", c.sellerId), "like_seller", {
      type: "seller",
      id: c.sellerId,
    });
    personal += conf * W.priceBand * get("price_band", c.priceBand === null ? null : String(c.priceBand));
    personal += conf * W.colour * Math.max(0, ...c.colourIds.map((id) => get("colour", id)));
    personal += conf * W.style * Math.max(0, ...c.styles.map((s) => get("style", s)));
    personal += conf * W.condition * get("condition", c.conditionId);

    const sizeTerm = Math.max(
      conf * get("size", c.sizeId),
      c.sizeId && taste.chosenSizes.has(c.sizeId) ? 1 : 0,
    );
    chosen += add(W.size * sizeTerm, "matches_size");
    if (taste.follows.has(c.sellerId))
      chosen += add(W.followsSeller, "follows_seller", { type: "seller", id: c.sellerId });
    if (c.brandId && taste.pickedBrands.has(c.brandId))
      chosen += add(W.pickedBrand, "like_brand", { type: "brand", id: c.brandId });

    const seen = taste.seen.get(c.id);
    if (seen && seen.shown >= SEEN_PENALTY_AFTER && seen.opened === 0) penalty = SEEN_PENALTY;
  }

  const G = GENERAL_WEIGHTS;
  const ageHours = (ctx.now.getTime() - c.bumpedAt.getTime()) / HOUR_MS;
  const freshness = Math.max(0, 1 - ageHours / FRESHNESS_HOURS);
  const publishedHours = c.publishedAt ? (ctx.now.getTime() - c.publishedAt.getTime()) / HOUR_MS : Infinity;
  const first = publishedHours < FIRST_CHANCE_HOURS && c.viewCount < FIRST_CHANCE_MAX_VIEWS;
  const dropped =
    c.previousPriceMinor !== null && c.priceMinor !== null && c.previousPriceMinor > c.priceMinor;
  const bumped = c.bumpedUntil !== null && c.bumpedUntil > ctx.now;
  const general =
    add(
      G.freshness * freshness,
      c.categoryId ? "new_in_category" : "new",
      c.categoryId ? { type: "category", id: c.categoryId } : null,
    ) +
    add(G.popularity * (c.pop / ctx.maxPop), "popular") +
    add(dropped ? G.priceDropped : 0, "price_drop") +
    add(bumped ? G.bumpedNow : 0, "new") +
    add(first ? G.firstChance : 0, "new");

  const learned = taste ? personal : 0;
  return { score: learned + chosen + general - penalty + shuffleOf(ctx.seed, c.id), terms };
}

/** The term that added the most, if it added enough to be worth saying. */
export function bestTerm(terms: readonly Term[]): Term | null {
  let best: Term | null = null;
  for (const t of terms) if (!best || t.value > best.value) best = t;
  return best && best.value >= REASON_MIN ? best : null;
}

// ---- Candidates ----

const candidateColumns = {
  id: listings.id,
  sellerId: listings.sellerId,
  categoryId: listings.categoryId,
  brandId: listings.brandId,
  brandName: listings.brandName,
  sizeId: listings.sizeId,
  conditionId: listings.conditionId,
  priceMinor: listings.priceMinor,
  previousPriceMinor: listings.previousPriceMinor,
  bumpedAt: listings.bumpedAt,
  bumpedUntil: listings.bumpedUntil,
  publishedAt: listings.publishedAt,
  viewCount: listings.viewCount,
  pop: sql<number>`coalesce(${listingPopularity7d.pop}, 0)`,
  colours: sql<string>`coalesce((select string_agg(${listingColours.colourId}::text, ',') from ${listingColours} where ${listingColours.listingId} = ${listings.id}), '')`,
  styles: listings.styles,
};

/** Everything the feed leaves out for this person, on top of the visibility rules. */
async function hiddenConditions(app: App, viewerId: string, reference: ReferenceData): Promise<SQL[]> {
  const rows = await app.db
    .select({ scope: feedHidden.scope, targetId: feedHidden.targetId })
    .from(feedHidden)
    .where(eq(feedHidden.userId, viewerId));
  const idsOf = (scope: string) => rows.filter((r) => r.scope === scope).map((r) => r.targetId);
  const conditions: SQL[] = [];
  const hide = (
    column:
      | typeof listings.id
      | typeof listings.sellerId
      | typeof listings.brandId
      | typeof listings.categoryId,
    ids: string[],
  ) => {
    if (ids.length === 0) return;
    const c = or(isNull(column), notInArray(column, ids));
    if (c) conditions.push(c);
  };
  hide(listings.id, idsOf("item"));
  hide(listings.sellerId, idsOf("seller"));
  hide(listings.brandId, idsOf("brand"));
  hide(listings.categoryId, [
    ...new Set(idsOf("category").flatMap((id) => categorySubtreeIds(reference.categories, id))),
  ]);
  return conditions;
}

export type FeedScope = {
  viewerId: string | undefined;
  categoryId?: string | undefined;
  mood?: FeedMood | undefined;
};

/** Every WHERE of the home feed: live listings, visibility, the chip, the mood, the person's own items and their hides. */
export async function feedConditions(app: App, scope: FeedScope, reference: ReferenceData): Promise<SQL[]> {
  const { viewerId, categoryId, mood } = scope;
  const where: SQL[] = [
    inArray(listings.status, [...BROWSABLE_STATUSES]),
    ...visibilityConditions(viewerId),
    ...filterConditions(categoryId ? { categoryId } : {}, reference),
    ...(await moodConditions(app.db, mood, viewerId)),
  ];
  if (viewerId) {
    where.push(sql`${listings.sellerId} <> ${viewerId}`);
    where.push(...(await hiddenConditions(app, viewerId, reference)));
  }
  return where;
}

type CandidateRow = {
  id: string;
  sellerId: string;
  categoryId: string | null;
  brandId: string | null;
  brandName: string | null;
  sizeId: string | null;
  conditionId: string | null;
  priceMinor: number | null;
  previousPriceMinor: number | null;
  bumpedAt: Date;
  bumpedUntil: Date | null;
  publishedAt: Date | null;
  viewCount: number;
  pop: number;
  colours: string;
  styles: string[];
};

function toCandidate(r: CandidateRow, explore: boolean): Candidate {
  return {
    id: r.id,
    sellerId: r.sellerId,
    categoryId: r.categoryId,
    brandId: r.brandId,
    brandName: r.brandName,
    sizeId: r.sizeId,
    conditionId: r.conditionId,
    priceBand: priceBand(r.priceMinor),
    priceMinor: r.priceMinor,
    previousPriceMinor: r.previousPriceMinor,
    bumpedAt: r.bumpedAt,
    bumpedUntil: r.bumpedUntil,
    publishedAt: r.publishedAt,
    viewCount: r.viewCount,
    pop: Number(r.pop),
    colourIds: r.colours ? r.colours.split(",") : [],
    styles: r.styles ?? [],
    explore,
  };
}

/** The four piles of section 3.1: taste, new, popular and a surprise. About 600 candidates, joined without repeats. */
async function loadCandidates(
  app: App,
  where: SQL[],
  taste: Taste | null,
  reference: ReferenceData,
  seed: string,
): Promise<Candidate[]> {
  const { db } = app;
  const select = (extra: SQL[], order: SQL[], limit: number) =>
    db
      .select(candidateColumns)
      .from(listings)
      .leftJoin(listingPopularity7d, eq(listingPopularity7d.listingId, listings.id))
      .where(and(...where, ...extra))
      .orderBy(...order)
      .limit(limit);

  const tasteConditions: SQL[] = [];
  if (taste) {
    const parts: (SQL | undefined)[] = [];
    if (taste.top.categories.length) parts.push(inArray(listings.categoryId, taste.top.categories));
    const parentIds = [
      ...new Set(taste.top.parents.flatMap((id) => categorySubtreeIds(reference.categories, id))),
    ];
    if (parentIds.length) parts.push(inArray(listings.categoryId, parentIds));
    const brands = [...new Set([...taste.top.brands, ...taste.pickedBrands])];
    if (brands.length) parts.push(inArray(listings.brandId, brands));
    const sellers = [...new Set([...taste.top.sellers, ...taste.follows])];
    if (sellers.length) parts.push(inArray(listings.sellerId, sellers));
    const any = or(...parts);
    if (any) tasteConditions.push(any);
  }
  const known = taste?.knownCategories ?? [];
  const exploreExtra: SQL[] = [sql`${listings.bumpedAt} > now() - interval '30 days'`];
  if (known.length) {
    const unknown = or(isNull(listings.categoryId), notInArray(listings.categoryId, known));
    if (unknown) exploreExtra.push(unknown);
  }

  const [tastePile, newPile, popularPile, explorePile] = await Promise.all([
    tasteConditions.length
      ? select(tasteConditions, [desc(listings.bumpedAt), desc(listings.id)], PILES.taste)
      : Promise.resolve([]),
    select(
      [sql`${listings.bumpedAt} > now() - ${`${NEW_PILE_DAYS} days`}::interval`],
      [desc(listings.bumpedAt), desc(listings.id)],
      PILES.new,
    ),
    select(
      [sql`${listingPopularity7d.pop} > 0`],
      [desc(listingPopularity7d.pop), desc(listings.bumpedAt)],
      PILES.popular,
    ),
    // The same surprises all day for one person, different between people.
    select(exploreExtra, [sql`md5(${listings.id}::text || ${seed})`], PILES.explore),
  ]);

  const byId = new Map<string, Candidate>();
  for (const row of [...tastePile, ...newPile, ...popularPile]) {
    if (!byId.has(row.id)) byId.set(row.id, toCandidate(row, false));
  }
  for (const row of explorePile) {
    const found = byId.get(row.id);
    if (found) found.explore = true;
    else byId.set(row.id, toCandidate(row, true));
  }
  return [...byId.values()];
}

// ---- Snapshot ----

type Snapshot = { id: string; listingIds: string[]; reasons: (FeedReason | null)[] };

async function resolveReason(
  kind: FeedReasonKind,
  ref: ReasonRef,
  c: Candidate,
  reference: ReferenceData,
  usernames: Map<string, string>,
): Promise<FeedReason> {
  let name: FeedReason["name"] = null;
  if (ref?.type === "category") {
    const node: CategoryNode | null = findCategory(reference.categories, ref.id);
    if (node) name = node.name;
  } else if (ref?.type === "brand" && c.brandName) {
    name = { en: c.brandName, he: c.brandName };
  } else if (ref?.type === "seller") {
    const username = usernames.get(ref.id);
    if (username) name = { en: username, he: username };
  }
  return { kind, name };
}

/** Sorts up to 500 items once, applies the variety rules and saves the list. */
async function createSnapshot(app: App, scope: FeedScope, reference: ReferenceData): Promise<Snapshot> {
  const now = new Date();
  const seed = `${scope.viewerId ?? "visitor"}|${now.toISOString().slice(0, 10)}`;
  const where = await feedConditions(app, scope, reference);
  const taste = await loadTaste(app, scope.viewerId, reference);
  const candidates = await loadCandidates(app, where, taste, reference, seed);

  const parentCache = new Map<string, readonly string[]>();
  const parentsOf = (id: string) => {
    let found = parentCache.get(id);
    if (!found) {
      found = parentCategoryIds(reference.categories, id);
      parentCache.set(id, found);
    }
    return found;
  };
  const maxPop = Math.max(1, ...candidates.map((c) => c.pop));
  const ctx: ScoreContext = { now, seed, maxPop, parentsOf };
  const scored = candidates
    .map((c) => ({ c, ...scoreCandidate(c, taste, ctx) }))
    .sort((a, b) => b.score - a.score || (a.c.id < b.c.id ? 1 : -1));

  const items: ScoredItem[] = scored.map(({ c, score }) => ({
    id: c.id,
    score,
    sellerId: c.sellerId,
    brandId: c.brandId,
    categoryId: c.categoryId,
    isBumped: c.bumpedUntil !== null && c.bumpedUntil > now,
    isExplore: c.explore,
  }));
  const arranged = arrangeFeed(items, SNAPSHOT_SIZE);

  const byId = new Map(scored.map((s) => [s.c.id, s]));
  const sellerNames = new Set<string>();
  for (const a of arranged) {
    const best = bestTerm(byId.get(a.id)?.terms ?? []);
    if (!a.explore && best?.ref?.type === "seller") sellerNames.add(best.ref.id);
  }
  const usernames = new Map<string, string>();
  if (sellerNames.size > 0) {
    const rows = await app.db
      .select({ id: users.id, username: users.username, display: users.displayUsername })
      .from(users)
      .where(inArray(users.id, [...sellerNames]));
    for (const r of rows) usernames.set(r.id, r.display ?? r.username ?? "");
  }
  const reasons: (FeedReason | null)[] = [];
  for (const a of arranged) {
    const entry = byId.get(a.id);
    if (!entry) {
      reasons.push(null);
      continue;
    }
    if (a.explore) {
      reasons.push({ kind: "explore", name: null });
      continue;
    }
    const best = bestTerm(entry.terms);
    reasons.push(best ? await resolveReason(best.kind, best.ref, entry.c, reference, usernames) : null);
  }

  const listingIds = arranged.map((a) => a.id);
  const [row] = await app.db
    .insert(feedSnapshots)
    .values({
      userId: scope.viewerId ?? null,
      categoryId: scope.categoryId ?? null,
      mood: scope.mood ?? null,
      listingIds,
      reasons,
    })
    .returning({ id: feedSnapshots.id });
  if (!row) throw new Error("Feed list was not saved");
  return { id: row.id, listingIds, reasons };
}

async function loadSnapshot(app: App, id: string, viewerId: string | undefined): Promise<Snapshot | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await app.db.select().from(feedSnapshots).where(eq(feedSnapshots.id, id)).limit(1);
  if (!row) return null;
  if ((row.userId ?? null) !== (viewerId ?? null)) return null;
  if (Date.now() - row.createdAt.getTime() > SNAPSHOT_TTL_MS) return null;
  return { id: row.id, listingIds: row.listingIds, reasons: row.reasons as (FeedReason | null)[] };
}

type FeedCursor = { f: string; o?: number; t?: string };

const bumpedMs = sql`(extract(epoch from ${listings.bumpedAt}) * 1000)::bigint`;

/**
 * One page of the home feed. The first page (no cursor) sorts and saves a list of up to 500 items for 2 hours, the
 * next pages cut 20 at a time from that saved list, so a heart in the middle of scrolling never repeats or skips a card.
 * After the saved list the feed goes newest first.
 */
export async function homeFeedPage(
  app: App,
  scope: FeedScope,
  opts: { cursor: string | undefined; limit: number },
): Promise<HomeFeedPage> {
  const reference = await app.reference.get();
  const { viewerId } = scope;
  const cursor = decodeCursor<FeedCursor>(opts.cursor);

  let snapshot: Snapshot | null = null;
  let offset = 0;
  if (cursor && typeof cursor.f === "string") {
    snapshot = await loadSnapshot(app, cursor.f, viewerId);
    offset = typeof cursor.o === "number" && cursor.o >= 0 ? cursor.o : 0;
  }
  // No cursor, or the saved list is gone (older than 2 hours): start over with a fresh list.
  if (!snapshot) {
    snapshot = await createSnapshot(app, scope, reference);
    offset = 0;
  }
  const where = await feedConditions(app, scope, reference);
  const ids = snapshot.listingIds;

  if (offset < ids.length) {
    const slice = ids.slice(offset, offset + opts.limit);
    const { rows } = await queryCardRows(app.db, {
      where: [...where, inArray(listings.id, slice)],
      sort: { key: bumpedMs, dir: "desc" },
      cursor: undefined,
      limit: slice.length,
    });
    const order = new Map(slice.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.listing.id) ?? 0) - (order.get(b.listing.id) ?? 0));
    const cards = await toCards(app, reference, rows, { viewerId, withSeller: true });
    const reasonOf = new Map(slice.map((id, i) => [id, snapshot.reasons[offset + i] ?? null]));
    const items: FeedCard[] = cards.map((card) => ({ ...card, reason: reasonOf.get(card.id) ?? null }));
    return {
      items,
      nextCursor: encodeCursor({ f: snapshot.id, o: offset + opts.limit } satisfies FeedCursor),
      feedId: snapshot.id,
    };
  }

  // Past the saved list: newest first, leaving out what the list already showed.
  const tail = await queryCardRows(app.db, {
    where: ids.length > 0 ? [...where, notInArray(listings.id, ids)] : where,
    sort: { key: bumpedMs, dir: "desc" },
    cursor: cursor?.t,
    limit: opts.limit,
  });
  const cards = await toCards(app, reference, tail.rows, { viewerId, withSeller: true });
  return {
    items: cards.map((card) => ({ ...card, reason: null })),
    nextCursor: tail.nextCursor
      ? encodeCursor({ f: snapshot.id, o: ids.length, t: tail.nextCursor } satisfies FeedCursor)
      : null,
    feedId: snapshot.id,
  };
}
