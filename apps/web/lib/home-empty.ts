import { type FeedMood, formatPrice, UNDER_50_MINOR } from "@vinty/shared";

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * The words for an empty Home feed, the same as the app: one title and note per mood chip. `hasSizes` and `city` only
 * matter for the logged in "Your sizes" and "Near you" chips (they say what is missing). The app also shows a button
 * to add sizes or a city, the website adds those with the settings pages in step W3.
 */
export function homeEmptyText(
  mood: FeedMood,
  t: T,
  who: { hasSizes?: boolean; city?: string | null } = {},
): { title: string; message: string } {
  switch (mood) {
    case "new_today":
      return { title: t("home.empty.newToday.title"), message: t("home.empty.newToday.note") };
    case "under_50":
      return {
        title: t("home.empty.under50.title", { amount: formatPrice(UNDER_50_MINOR, "ILS") }),
        message: t("home.empty.under50.note"),
      };
    case "your_sizes":
      return who.hasSizes === false
        ? { title: t("home.empty.sizesUnset.title"), message: t("home.empty.sizesUnset.note") }
        : { title: t("home.empty.sizes.title"), message: t("home.empty.sizes.note") };
    case "near_you":
      return who.city === null || who.city === ""
        ? { title: t("home.empty.cityUnset.title"), message: t("home.empty.cityUnset.note") }
        : { title: t("home.empty.near.title", { city: who.city ?? "" }), message: t("home.empty.near.note") };
    default:
      return { title: t("home.emptyTitle"), message: t("home.emptyMessage") };
  }
}
