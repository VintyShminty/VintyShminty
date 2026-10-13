import type { NotificationChannel, NotificationType } from "./enums.js";

/**
 * Which notification switches the Settings screens show, and in which group.
 * Only types the spec shows are listed. The other types still have a stored preference (default on)
 * and get their own switch when the milestone that sends them ships.
 */
export const NOTIFICATION_SETTINGS_GROUPS: {
  group: "high" | "other";
  types: NotificationType[];
}[] = [
  { group: "high", types: ["new_message", "review_received", "favourite_price_drop"] },
  {
    group: "other",
    types: ["listing_favourited", "favourite_sold", "new_follower", "followed_seller_new_item"],
  },
];

/** A missing row means the default, which is on for every type and channel. */
export const NOTIFICATION_DEFAULT_ENABLED = true;

/** Choices for the daily push limit. Null means no limit. */
export const PUSH_DAILY_LIMIT_OPTIONS: (number | null)[] = [null, 5, 10, 20, 50];

export type NotificationPreferenceKey = `${NotificationType}:${NotificationChannel}`;

/**
 * Types that ignore the daily push limit (the "High priority" rows of the push table in api.md).
 * Everything else counts towards `push_daily_limit` and stops when it is used up.
 */
export const HIGH_PRIORITY_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "new_message",
  "new_offer",
  "offer_accepted",
  "offer_declined",
  "offer_countered",
  "review_received",
  "favourite_price_drop",
  "order_paid",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "listing_removed",
];
