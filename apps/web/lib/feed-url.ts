import { FEED_GROUPS, FEED_MOODS, type FeedGroup, type FeedMood } from "@vinty/shared";

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

/** The Men and Women pills, in order. */
export const GROUPS: FeedGroup[] = ["women", "men"];

/** The group from `?group=`, or null when it is missing or not one we know. */
export function parseGroup(value: string | string[] | undefined): FeedGroup | null {
  const first = Array.isArray(value) ? value[0] : value;
  return FEED_GROUPS.find((g) => g === first) ?? null;
}

/** The home feed address for a mood and an optional group, without paging. `for_you` with no group is the plain feed. */
export function feedPath(mood: FeedMood, group: FeedGroup | null = null): string {
  const params = new URLSearchParams();
  if (mood !== "for_you") params.set("mood", mood);
  if (group) params.set("group", group);
  const query = params.toString();
  return query ? `/v1/feed?${query}` : "/v1/feed";
}

/** Adds the page size and the cursor to an address that may already have a query: `/v1/feed?mood=x` becomes `...&limit=20&cursor=abc`. */
export function pagePath(path: string, cursor?: string, limit = FEED_PAGE_SIZE): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
}

/** Home address for a mood and group: `/en`, `/en?mood=new_today`, `/en?group=men` or both together. */
export function homeHref(lang: string, mood: FeedMood, group: FeedGroup | null = null): string {
  const params = new URLSearchParams();
  if (mood !== "for_you") params.set("mood", mood);
  if (group) params.set("group", group);
  const query = params.toString();
  return query ? `/${lang}?${query}` : `/${lang}`;
}
