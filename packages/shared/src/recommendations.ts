import type { AffinityFeature, UserEventType } from "./enums.js";

/** How much each kind of action says about taste. Changing a weight is a one line edit. */
export const EVENT_WEIGHTS: Record<UserEventType, number> = {
  purchase: 8,
  offer: 6,
  message_seller: 5,
  favourite: 4,
  unfavourite: -4,
  save_search: 3,
  onboarding_pick: 3,
  listing_open_repeat: 2,
  listing_open: 1,
  listing_dwell: 1,
  search: 1,
  category_visit: 0.5,
  not_interested: -3,
  impression: 0,
};

/** Each feature of an item gets this share of the action's weight. */
export const FEATURE_SHARES: Record<AffinityFeature, number> = {
  category: 1,
  parent_category: 0.5,
  brand: 0.8,
  seller: 0.7,
  size: 0.6,
  price_band: 0.5,
  colour: 0.3,
  condition: 0.3,
  style: 0.6,
};

/**
 * A taste score drops to half after this many days without a new action. Eden chose 7 on 2026-10-13 and 30 on
 * 2026-11-18: on the live site people were active about 2 days in 5 weeks, so with 7 days Home had forgotten them by
 * the time they came back (plan section 14).
 */
export const HALF_LIFE_DAYS = 30;
const DAY_MS = 86_400_000;

/** Scores below this are deleted by the nightly cleanup. */
export const AFFINITY_FLOOR = 0.05;
/** The nightly cleanup keeps this many lines per feature per person. */
export const AFFINITIES_PER_FEATURE = 50;

/** A score as it is worth right now. Nothing runs at night to fade scores, the math happens when one is read. */
export const effectiveScore = (
  score: number,
  scoredAt: Date,
  now: Date = new Date(),
  halfLifeDays: number = HALF_LIFE_DAYS,
): number => score * 0.5 ** (Math.max(0, now.getTime() - scoredAt.getTime()) / (halfLifeDays * DAY_MS));

/**
 * Interest in a category outside the person's own shopping groups (a "corner", plan section 11.3) comes and goes
 * quickly (plan section 19, Eden 2026-11-27: "a constant breathing change"). It fades to half in 7 days instead of 30...
 */
export const CORNER_HALF_LIFE_DAYS = 7;
/**
 * ...and every point of a liking action inside the person's own groups (an open is 1, a heart 4) leaves it this share
 * of what it was. Looking at that corner again adds to it as usual.
 */
export const CORNER_KEEP_PER_POINT = 0.9;

/** 0 for a new person, 1 after about 30 points of recent activity. The feed becomes personal as this grows. */
export const CONFIDENCE_POINTS = 30;
export const confidence = (totalEffectiveScore: number): number =>
  Math.min(1, Math.max(0, totalEffectiveScore / CONFIDENCE_POINTS));

/** Price bands in minor units (agorot): under 50, 50 to 100, 100 to 200, 200 to 400, 400 to 800, 800 and above. */
export const PRICE_BAND_LIMITS_MINOR = [5000, 10_000, 20_000, 40_000, 80_000] as const;
export const priceBand = (priceMinor: number | null | undefined): number | null => {
  if (priceMinor === null || priceMinor === undefined || priceMinor < 0) return null;
  const index = PRICE_BAND_LIMITS_MINOR.findIndex((limit) => priceMinor < limit);
  return index === -1 ? PRICE_BAND_LIMITS_MINOR.length : index;
};

/** What the feed needs to know about an item to learn from it. */
export type ItemFeatures = {
  categoryId?: string | null | undefined;
  /** Every category above the item's own, closest first (for example Clothing, then Women). */
  parentCategoryIds?: readonly string[] | undefined;
  brandId?: string | null | undefined;
  sellerId?: string | null | undefined;
  sizeId?: string | null | undefined;
  priceMinor?: number | null | undefined;
  colourIds?: readonly string[] | undefined;
  conditionId?: string | null | undefined;
  /** Style tags (D-042), up to 3, behind the scenes only. */
  styles?: readonly string[] | undefined;
};

export type AffinityDelta = { feature: AffinityFeature; key: string; delta: number };

/**
 * One action adds score to each feature of the item: a heart (4) on a Zara dress adds 4 to Dresses, 3.2 to Zara and
 * 2.4 to its size. Deltas for the same feature and key are added together.
 */
export function affinityDeltas(weight: number, item: ItemFeatures): AffinityDelta[] {
  if (weight === 0) return [];
  const sums = new Map<string, AffinityDelta>();
  const add = (feature: AffinityFeature, key: string | null | undefined) => {
    if (!key) return;
    const id = `${feature}:${key}`;
    const found = sums.get(id);
    const delta = weight * FEATURE_SHARES[feature];
    if (found) found.delta += delta;
    else sums.set(id, { feature, key, delta });
  };
  add("category", item.categoryId);
  for (const id of item.parentCategoryIds ?? []) add("parent_category", id);
  add("brand", item.brandId);
  add("seller", item.sellerId);
  add("size", item.sizeId);
  const band = priceBand(item.priceMinor);
  if (band !== null) add("price_band", String(band));
  for (const id of item.colourIds ?? []) add("colour", id);
  add("condition", item.conditionId);
  for (const style of item.styles ?? []) add("style", style);
  return [...sums.values()];
}

/** The terms of the personal part of the score, with their weights. Each term runs from 0 to 1. */
export const PERSONAL_WEIGHTS = {
  category: 1,
  parentCategory: 0.5,
  brand: 0.8,
  size: 0.6,
  priceBand: 0.5,
  colour: 0.3,
  condition: 0.3,
  style: 0.6,
  seller: 1,
  followsSeller: 1,
  pickedBrand: 0.6,
} as const;

/** The general part of the score. */
export const GENERAL_WEIGHTS = {
  freshness: 0.6,
  popularity: 0.4,
  priceDropped: 0.2,
  bumpedNow: 0.3,
  firstChance: 0.2,
} as const;

export const FRESHNESS_HOURS = 48;
/** A price drop lifts an item on Home for this many days after the price went down (plan section 13.1). */
export const PRICE_DROP_DAYS = 7;
/** The new price has to be at least this share below every price the item had in the last PRICE_DROP_LOOKBACK_DAYS. */
export const PRICE_DROP_MIN_SHARE = 0.1;
export const PRICE_DROP_LOOKBACK_DAYS = 30;

/**
 * Whether a lowered price earns the "price dropped" lift on Home. One shekel off does not, a drop from long ago does
 * not, and neither does raising the price and lowering it again: the price is compared with the lowest one the item
 * had in the last 30 days, not with the last one.
 */
export function countsAsPriceDrop(drop: {
  priceMinor: number | null;
  /** The lowest price the item had before a change in the last 30 days. Null when the price did not change. */
  lowestRecentPriceMinor: number | null;
  /** Days since the price last went down. Null when it never did. */
  ageDays: number | null;
}): boolean {
  const { priceMinor, lowestRecentPriceMinor, ageDays } = drop;
  if (priceMinor === null || lowestRecentPriceMinor === null || ageDays === null) return false;
  return ageDays < PRICE_DROP_DAYS && priceMinor <= lowestRecentPriceMinor * (1 - PRICE_DROP_MIN_SHARE);
}
export const FIRST_CHANCE_HOURS = 72;
export const FIRST_CHANCE_MAX_VIEWS = 50;
/**
 * A card shown on Home in the last 7 days and never opened moves down a little more each time (plan section 15).
 * Per view it loses a tenth of SEEN_PENALTY outright, which is what moves a card for a person Home knows little about,
 * and its taste score counts SEEN_KEEP_PER_VIEW of what it did (never under SEEN_KEEP_MIN), which is what moves a
 * strong taste match. Small steps on purpose: the first cards of Home are "seen" every time the app opens.
 */
export const SEEN_PENALTY = 0.5;
/** The full SEEN_PENALTY is reached after this many views. */
export const SEEN_PENALTY_VIEWS = 10;
export const SEEN_KEEP_PER_VIEW = 0.95;
export const SEEN_KEEP_MIN = 0.4;
/** A new listing shown this many times and never opened gives up its kept spot (section 12.1). */
export const FRESH_SLOT_MAX_VIEWS = 3;

/** What `shown` views without an open do to a card: the share of its taste score it keeps and what it loses outright. */
export function seenEffect(shown: number): { keep: number; minus: number } {
  const views = Math.max(0, shown);
  return {
    keep: Math.max(SEEN_KEEP_MIN, SEEN_KEEP_PER_VIEW ** views),
    minus: SEEN_PENALTY * Math.min(1, views / SEEN_PENALTY_VIEWS),
  };
}
/**
 * An item the person opened in the last 7 days keeps only this share of its taste score on Home, so the same cards do
 * not sit on top on every visit (plan section 12.2). What the open taught about their taste stays.
 */
export const OPENED_KEEP = 0.5;
/**
 * A listing counts as new for the reserved spots of a page for this long after it was published (plan section 12.1).
 * 72 hours at first, 7 days since 2026-11-18: the live shop got 4 new listings in a week and none in the last 3 days,
 * so the spots had nothing to show (plan section 16). Worth shortening again when listings arrive every day.
 */
export const FRESH_SLOT_HOURS = 7 * 24;
export const SHUFFLE_SIZE = 0.1;
/**
 * Shopping groups (Women, Men, Kids, plan section 11). Items in a group the person does not shop for move this much
 * lower on Home, never hidden. 0.3 at first (Eden: "a bit lower"), 1 since 2026-11-27: a price drop, a popular week
 * or a card of the person's own group that was scrolled past (up to 0.5) each outweighed 0.3, so on a shop that is
 * mostly women's items a man's Home stayed women's (plan section 18.2).
 */
export const OTHER_GROUP_MINUS = 1;
/** Without an answer, a group counts as the person's own when it holds this share of their learned group taste... */
export const INFERRED_GROUP_SHARE = 0.6;
/** ...and only once there is this much of it (points, after fading). */
export const INFERRED_GROUP_MIN_POINTS = 5;
/** A corner outside the person's groups stays open while its taste is at least this (0 to 1, against their best). */
export const CORNER_MIN = 0.2;
/** Surprise cards come from the person's groups, or from the whole site when those have fewer recent items than this. */
export const EXPLORE_GROUP_MIN = 10;

/**
 * The person's own shopping groups as top category ids. Their answer wins. Without one, the group holding most of
 * their learned taste counts once it is clear enough. Null means unknown: nothing is lowered.
 */
export function resolveGroups(
  answer: readonly string[],
  groupRoots: ReadonlyMap<string, string>,
  learned: ReadonlyMap<string, number>,
): Set<string> | null {
  const picked = answer.flatMap((slug) => groupRoots.get(slug) ?? []);
  if (picked.length > 0) return new Set(picked);
  const ids = [...groupRoots.values()];
  const total = ids.reduce((n, id) => n + (learned.get(id) ?? 0), 0);
  if (total < INFERRED_GROUP_MIN_POINTS) return null;
  const top = ids.find((id) => (learned.get(id) ?? 0) / total >= INFERRED_GROUP_SHARE);
  return top ? new Set([top]) : null;
}

/** Newest items in the last 7 days make up the "new" pile. */
export const NEW_PILE_DAYS = 7;

/**
 * `group` is the newest items of the person's own shopping groups (plan section 18.1). Without it, choosing Men only
 * lowered the rest: an older men's item nobody looked at lately was never considered for Home at all.
 */
export const PILES = { taste: 300, new: 150, popular: 100, explore: 50, searched: 60, group: 200 } as const;

/** How many of a search's best results are read to work out what it was about (plan section 17.1). */
export const SEARCH_INTENT_SAMPLE = 20;
/** A brand is what the search was about when it holds this share of those results. */
export const SEARCH_INTENT_SHARE = 0.6;
/**
 * A category needs more of them. "adidas" finds mostly clothing and some shoes: that search is about Adidas, not about
 * Adidas clothing. "nike sneakers" finds sneakers only.
 */
export const SEARCH_INTENT_CATEGORY_SHARE = 0.8;
/** A search keeps its cards on Home for this many days (plan section 17.2). */
export const SEARCH_SLOT_DAYS = 7;
/** Home looks at this many of the person's latest searches (one search can be about three categories). */
export const SEARCH_SLOT_SEARCHES = 6;

/** One search is about at most this many categories (the same kind of item under Women, Men and Kids). */
export const SEARCH_INTENT_CATEGORIES = 3;

/**
 * What a search was about, read from its best results. `trail` is the path of a result's category from the top
 * (Women) down to its own (Sneakers), empty when it has none. `kinds` names the same steps without the top one
 * ("", "Shoes", "Shoes > Sneakers"), so the same kind of item can be recognised under Women, Men and Kids.
 *
 * The category is the deepest one that holds enough of the results: "nike sneakers" gives Sneakers, "shoes" gives
 * Shoes. When the results are the same kind of item spread over the groups (sneakers for women, men and kids), the
 * search is about each of those. The brand is the one most of the results share. Nothing means nothing in particular:
 * no results, or a bit of everything.
 */
export function searchIntent(
  results: readonly { trail: readonly string[]; kinds?: readonly string[]; brandId: string | null }[],
): { categoryIds: string[]; brandId: string | null } {
  if (results.length === 0) return { categoryIds: [], brandId: null };
  const need = results.length * SEARCH_INTENT_CATEGORY_SHARE;
  const needBrand = results.length * SEARCH_INTENT_SHARE;
  const nodes = new Map<string, { count: number; depth: number }>();
  const kinds = new Map<string, { count: number; depth: number; ids: Map<string, number> }>();
  const brands = new Map<string, number>();
  for (const r of results) {
    r.trail.forEach((id, depth) => {
      const found = nodes.get(id);
      if (found) found.count += 1;
      else nodes.set(id, { count: 1, depth });
      const kind = depth > 0 ? r.kinds?.[depth] : undefined;
      if (!kind) return;
      const family = kinds.get(kind) ?? { count: 0, depth, ids: new Map<string, number>() };
      family.count += 1;
      family.ids.set(id, (family.ids.get(id) ?? 0) + 1);
      kinds.set(kind, family);
    });
    if (r.brandId) brands.set(r.brandId, (brands.get(r.brandId) ?? 0) + 1);
  }
  const deepest = <T extends { count: number; depth: number }>(all: Iterable<T>): T | null => {
    let best: T | null = null;
    for (const one of all) {
      if (one.count < need) continue;
      if (!best || one.depth > best.depth || (one.depth === best.depth && one.count > best.count)) best = one;
    }
    return best;
  };
  const one = deepest([...nodes].map(([id, node]) => ({ id, ...node })));
  const family = deepest(kinds.values());
  let categoryIds: string[] = [];
  // One real category below the top wins. Then the same kind of item over several groups. Then a whole group.
  if (one && one.depth > 0 && (!family || family.depth <= one.depth)) categoryIds = [one.id];
  else if (family) {
    categoryIds = [...family.ids]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SEARCH_INTENT_CATEGORIES)
      .map(([id]) => id);
  } else if (one) categoryIds = [one.id];

  let brandId: string | null = null;
  for (const [id, count] of brands) {
    if (count >= needBrand && count > (brandId ? (brands.get(brandId) ?? 0) : 0)) brandId = id;
  }
  return { categoryIds, brandId };
}
/** The first page builds one sorted list of this many items and saves it. After that the feed goes newest first. */
export const SNAPSHOT_SIZE = 500;
export const SNAPSHOT_TTL_MS = 2 * 60 * 60 * 1000;

/** A page never fills with one seller, brand or category. Eden chose 3 surprise cards in 20. */
export const VARIETY = {
  perPage: 20,
  maxPerSeller: 2,
  maxPerBrand: 4,
  maxPerCategory: 6,
  maxBumpedPerSix: 1,
  exploreSlots: [5, 12, 19],
  /** Up to 4 cards in 20 go to new listings that match the person, best fit first (plan section 12.1). */
  freshSlots: [1, 6, 11, 16],
  /** Up to 2 cards in 20 go to what the person searched for in the last 7 days (plan section 17.2). */
  searchSlots: [3, 9],
} as const;

/** Raw actions are kept this long. Impressions ("card seen") are kept a shorter time. */
export const EVENT_RETENTION_DAYS = 180;
export const IMPRESSION_RETENTION_DAYS = 30;
export const SNAPSHOT_RETENTION_HOURS = 6;

/** Actions allowed per person per minute through POST /v1/events. */
export const EVENTS_PER_MINUTE = 200;

export type ScoredItem = {
  id: string;
  score: number;
  sellerId: string;
  brandId: string | null;
  categoryId: string | null;
  isBumped: boolean;
  /** Eligible for the surprise slots. */
  isExplore: boolean;
  /** Eligible for the spots kept for new listings. */
  isFresh: boolean;
  /** Eligible for the spots kept for what the person searched for lately. */
  isSearched: boolean;
};

/**
 * Cuts one sorted list into pages that follow the variety rules. Items that do not fit a page stay for the next one.
 * The surprise slots take the best unused explore item, the new listing spots the best unused new one and the search
 * spots the best unused item the person searched for. When nothing fits, the rules give way rather than leave a hole.
 * Returns the item ids in order together with the kind of spot each one was placed in, if any.
 */
export function arrangeFeed(
  sorted: readonly ScoredItem[],
  limit: number,
  variety: Omit<typeof VARIETY, "exploreSlots" | "freshSlots" | "searchSlots"> & {
    exploreSlots: readonly number[];
    freshSlots: readonly number[];
    searchSlots: readonly number[];
  } = VARIETY,
): { id: string; explore: boolean; fresh: boolean; searched: boolean }[] {
  const pool = [...sorted];
  const out: { id: string; explore: boolean; fresh: boolean; searched: boolean }[] = [];
  const bumpedAt: number[] = [];
  while (out.length < limit && pool.length > 0) {
    const sellers = new Map<string, number>();
    const brands = new Map<string, number>();
    const categories = new Map<string, number>();
    const bump = (map: Map<string, number>, key: string | null) => {
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    };
    for (let slot = 0; slot < variety.perPage && out.length < limit && pool.length > 0; slot++) {
      const fits = (item: ScoredItem) =>
        (sellers.get(item.sellerId) ?? 0) < variety.maxPerSeller &&
        (!item.brandId || (brands.get(item.brandId) ?? 0) < variety.maxPerBrand) &&
        (!item.categoryId || (categories.get(item.categoryId) ?? 0) < variety.maxPerCategory) &&
        (!item.isBumped || bumpedAt.filter((p) => out.length - p < 6).length < variety.maxBumpedPerSix);
      const wantsExplore = variety.exploreSlots.includes(slot);
      const wantsFresh = variety.freshSlots.includes(slot);
      let index = -1;
      if (wantsExplore) index = pool.findIndex((i) => i.isExplore && fits(i));
      const surprise = index !== -1;
      if (!surprise && wantsFresh) index = pool.findIndex((i) => i.isFresh && fits(i));
      const fresh = !surprise && index !== -1;
      if (index === -1 && variety.searchSlots.includes(slot)) {
        index = pool.findIndex((i) => i.isSearched && fits(i));
      }
      const searched = !surprise && !fresh && index !== -1;
      if (index === -1) index = pool.findIndex(fits);
      if (index === -1) index = 0;
      const [item] = pool.splice(index, 1) as [ScoredItem];
      out.push({ id: item.id, explore: surprise, fresh, searched });
      sellers.set(item.sellerId, (sellers.get(item.sellerId) ?? 0) + 1);
      bump(brands, item.brandId);
      bump(categories, item.categoryId);
      if (item.isBumped) bumpedAt.push(out.length - 1);
    }
  }
  return out;
}
