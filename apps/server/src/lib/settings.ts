import { type Database, platformSettings } from "@vinty/db";

type Db = NonNullable<Database["db"]>;

/** The numbers from `platform_settings` that offers and orders use, with the seeded values as fallbacks. */
export type OrderSettings = {
  offerDailyLimit: number;
  offerExpiryHours: number;
  acceptedOfferHoldHours: number;
  checkoutHoldMinutes: number;
  shipByDays: number;
  autoCompleteHoursAfterDelivery: number;
  autoReviewRating: number;
  referralRewardMinor: number;
  referralMinOrderMinor: number;
};

const DEFAULTS: OrderSettings = {
  offerDailyLimit: 15,
  offerExpiryHours: 48,
  acceptedOfferHoldHours: 24,
  checkoutHoldMinutes: 30,
  shipByDays: 5,
  autoCompleteHoursAfterDelivery: 48,
  autoReviewRating: 5,
  referralRewardMinor: 5000,
  referralMinOrderMinor: 5000,
};

const KEYS: Record<keyof OrderSettings, string> = {
  offerDailyLimit: "offer_daily_limit",
  offerExpiryHours: "offer_expiry_hours",
  acceptedOfferHoldHours: "accepted_offer_hold_hours",
  checkoutHoldMinutes: "checkout_hold_minutes",
  shipByDays: "ship_by_days",
  autoCompleteHoursAfterDelivery: "auto_complete_hours_after_delivery",
  autoReviewRating: "auto_review_rating",
  referralRewardMinor: "referral_reward_minor",
  referralMinOrderMinor: "referral_min_order_minor",
};

export async function loadOrderSettings(db: Db): Promise<OrderSettings> {
  const rows = await db.select().from(platformSettings);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const result = { ...DEFAULTS };
  for (const name of Object.keys(KEYS) as (keyof OrderSettings)[]) {
    const value = byKey.get(KEYS[name]);
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) result[name] = value;
  }
  return result;
}

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * HOUR_MS;
