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
};

/** A taste score drops to half after this many days without a new action (Eden chose 7). */
export const HALF_LIFE_DAYS = 7;
const DAY_MS = 86_400_000;

/** Scores below this are deleted by the nightly cleanup. */
export const AFFINITY_FLOOR = 0.05;
/** The nightly cleanup keeps this many lines per feature per person. */
export const AFFINITIES_PER_FEATURE = 50;

/** A score as it is worth right now. Nothing runs at night to fade scores, the math happens when one is read. */
export const effectiveScore = (score: number, scoredAt: Date, now: Date = new Date()): number =>
  score * 0.5 ** (Math.max(0, now.getTime() - scoredAt.getTime()) / (HALF_LIFE_DAYS * DAY_MS));

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
export const FIRST_CHANCE_HOURS = 72;
export const FIRST_CHANCE_MAX_VIEWS = 50;
/** Shown this many times in 7 days and never opened: the item drops. */
export const SEEN_PENALTY_AFTER = 3;
export const SEEN_PENALTY = 0.5;
export const SHUFFLE_SIZE = 0.1;
/** Newest items in the last 7 days make up the "new" pile. */
export const NEW_PILE_DAYS = 7;

export const PILES = { taste: 300, new: 150, popular: 100, explore: 50 } as const;
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
};

/**
 * Cuts one sorted list into pages that follow the variety rules. Items that do not fit a page stay for the next one.
 * The surprise slots take the best unused explore item. When nothing fits, the rules give way rather than leave a hole.
 * Returns the item ids in order together with whether each one was placed in a surprise slot.
 */
export function arrangeFeed(
  sorted: readonly ScoredItem[],
  limit: number,
  variety: Omit<typeof VARIETY, "exploreSlots"> & { exploreSlots: readonly number[] } = VARIETY,
): { id: string; explore: boolean }[] {
  const pool = [...sorted];
  const out: { id: string; explore: boolean }[] = [];
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
      let index = -1;
      if (wantsExplore) index = pool.findIndex((i) => i.isExplore && fits(i));
      const surprise = index !== -1;
      if (!surprise) index = pool.findIndex(fits);
      if (index === -1) index = 0;
      const [item] = pool.splice(index, 1) as [ScoredItem];
      out.push({ id: item.id, explore: surprise });
      sellers.set(item.sellerId, (sellers.get(item.sellerId) ?? 0) + 1);
      bump(brands, item.brandId);
      bump(categories, item.categoryId);
      if (item.isBumped) bumpedAt.push(out.length - 1);
    }
  }
  return out;
}
