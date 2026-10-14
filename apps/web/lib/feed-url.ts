import { FEED_MOODS, type FeedMood } from "@vinty/shared";

export const FEED_PAGE_SIZE = 20;

/** The mood chips in order. The last two need an account (sizes and city), as in the app. */
export const MOODS: { key: FeedMood; needsAccount: boolean }[] = [
  { key: "for_you", needsAccount: false },
  { key: "new_today", needsAccount: false },
  { key: "under_50", needsAccount: false },
  { key: "your_sizes", needsAccount: true },
  { key: "near_you", needsAccount: true },
];

/** The mood from `?mood=`, or "for_you" when it is missing or not one we know. */
export function parseMood(value: string | string[] | undefined): FeedMood {
  const first = Array.isArray(value) ? value[0] : value;
  return FEED_MOODS.find((m) => m === first) ?? "for_you";
}

/** The home feed address for a mood, without paging. `for_you` is the plain feed. */
export function feedPath(mood: FeedMood): string {
  return mood === "for_you" ? "/v1/feed" : `/v1/feed?mood=${mood}`;
}

/** Adds the page size and the cursor to an address that may already have a query: `/v1/feed?mood=x` becomes `...&limit=20&cursor=abc`. */
export function pagePath(path: string, cursor?: string, limit = FEED_PAGE_SIZE): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
}

/** Home address for a mood: `/en` or `/en?mood=new_today`. */
export function homeHref(lang: string, mood: FeedMood): string {
  return mood === "for_you" ? `/${lang}` : `/${lang}?mood=${mood}`;
}
