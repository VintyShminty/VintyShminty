import { FEED_GROUPS, FEED_MOODS, type FeedGroup, type FeedMood } from "@vinty/shared";

export const FEED_PAGE_SIZE = 20;

/** The mood chips in order. The last two need an account (sizes and city), as in the app. */
export const MOODS: { key: FeedMood; needsAccount: boolean }[] = [
  { key: "for_you", needsAccount: false },
  { key: "new_today", needsAccount: false },
  { key: "your_sizes", needsAccount: true },
  { key: "near_you", needsAccount: true },
];

/** The mood from `?mood=`, or "for_you" when it is missing or not one we know. */
export function parseMood(value: string | string[] | undefined): FeedMood {
  const first = Array.isArray(value) ? value[0] : value;
  return FEED_MOODS.find((m) => m === first) ?? "for_you";
}

/** The Men and Women pills, in order. */
export const GROUPS: FeedGroup[] = ["women", "men"];

/** The group from `?group=`, or null when it is missing or not one we know. */
export function parseGroup(value: string | string[] | undefined): FeedGroup | null {
  const first = Array.isArray(value) ? value[0] : value;
  return FEED_GROUPS.find((g) => g === first) ?? null;
}

/** The Price chip's range in whole shekels. Either end can be missing. */
export type PriceRange = { min?: number | undefined; max?: number | undefined };

/** The quick picks of the Price chip, in whole shekels. */
export const PRICE_PICKS: PriceRange[] = [
  { max: 50 },
  { min: 50, max: 100 },
  { min: 100, max: 200 },
  { min: 200 },
];

/** A range with the ends in order (the server does the same). */
export function orderedRange(range: PriceRange): PriceRange {
  const { min, max } = range;
  return min !== undefined && max !== undefined && min > max ? { min: max, max: min } : { min, max };
}

export const hasPrice = (range: PriceRange) => range.min !== undefined || range.max !== undefined;

function wholeShekels(value: string | string[] | undefined): number | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first !== undefined && /^\d{1,7}$/.test(first) ? Number(first) : undefined;
}

/** The range from `?priceMin=` and `?priceMax=` (whole shekels), empty when missing or not a whole number. */
export function parsePrice(
  min: string | string[] | undefined,
  max: string | string[] | undefined,
): PriceRange {
  return orderedRange({ min: wholeShekels(min), max: wholeShekels(max) });
}

function setPrice(
  params: URLSearchParams,
  price: PriceRange,
  minKey: string,
  maxKey: string,
  factor: number,
) {
  if (price.min !== undefined) params.set(minKey, String(price.min * factor));
  if (price.max !== undefined) params.set(maxKey, String(price.max * factor));
}

/**
 * The home feed address for a mood, an optional group and an optional price range, without paging. `for_you` with
 * nothing else is the plain feed. The API takes the price in minor units (shekels x 100).
 */
export function feedPath(mood: FeedMood, group: FeedGroup | null = null, price: PriceRange = {}): string {
  const params = new URLSearchParams();
  if (mood !== "for_you") params.set("mood", mood);
  if (group) params.set("group", group);
  setPrice(params, price, "priceMinMinor", "priceMaxMinor", 100);
  const query = params.toString();
  return query ? `/v1/feed?${query}` : "/v1/feed";
}

/** Adds the page size and the cursor to an address that may already have a query: `/v1/feed?mood=x` becomes `...&limit=20&cursor=abc`. */
export function pagePath(path: string, cursor?: string, limit = FEED_PAGE_SIZE): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
}

/** Home address: `/en`, `/en?mood=new_today`, `/en?group=men`, `/en?priceMin=50&priceMax=100` or them together. */
export function homeHref(
  lang: string,
  mood: FeedMood,
  group: FeedGroup | null = null,
  price: PriceRange = {},
): string {
  const params = new URLSearchParams();
  if (mood !== "for_you") params.set("mood", mood);
  if (group) params.set("group", group);
  setPrice(params, price, "priceMin", "priceMax", 1);
  const query = params.toString();
  return query ? `/${lang}?${query}` : `/${lang}`;
}
