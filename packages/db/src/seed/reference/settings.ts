import type { Named } from "./types.js";

/** Buyer protection fee. Decided 2026-10-12: 5% of the item price, no fixed part (general placeholder, to be revisited). ILS only. */
export const feeRuleSeed = [{ currency: "ILS", buyerFeeBasisPoints: 500, buyerFeeFixedMinor: 0 }];

export const platformSettingSeed: { key: string; value: unknown; description: string }[] = [
  { key: "default_currency", value: "ILS", description: "Currency used when a user has not picked one" },
  {
    key: "offer_daily_limit",
    value: 15,
    description: "How many offers one buyer may send per rolling 24 hours",
  },
  { key: "offer_expiry_hours", value: 48, description: "Hours before an unanswered offer expires" },
  {
    key: "accepted_offer_hold_hours",
    value: 24,
    description: "Hours the buyer has to check out after an accepted offer",
  },
  {
    key: "checkout_hold_minutes",
    value: 30,
    description: "Minutes a listing stays reserved while an order waits for payment",
  },
  {
    key: "ship_by_days",
    value: 5,
    description: "Days the seller has to mark the order shipped before it cancels itself",
  },
  {
    key: "auto_complete_hours_after_delivery",
    value: 48,
    description: "Hours after delivery before an order completes without the buyer",
  },
  {
    key: "auto_review_rating",
    value: 5,
    description: "Stars given by the automatic review when a sale completes",
  },
  { key: "listing_max_photos", value: 20, description: "Most photos on one listing" },
  { key: "listing_min_price_minor", value: 100, description: "Lowest allowed item price in minor units" },
  {
    key: "referral_reward_minor",
    value: 5000,
    description: "Voucher given to both sides of a referral, in minor units",
  },
  {
    key: "referral_min_order_minor",
    value: 5000,
    description: "Smallest order the referral voucher can be used on",
  },
  { key: "bundle_min_items", value: 2, description: "Items needed before a bundle can apply" },
  {
    key: "single_market",
    value: true,
    description: "True: Israel and ILS only (decided 2026-10-12)",
  },
];

export const bundleDiscountDefaults = [
  { minItems: 2, percentOff: 5 },
  { minItems: 3, percentOff: 10 },
  { minItems: 5, percentOff: 15 },
];

export const bumpPlanSeed: (Named & { slug: string; durationHours: number; priceMinor: number })[] = [
  { slug: "bump-3d", en: "Boost for 3 days", he: "הקפצה ל-3 ימים", durationHours: 72, priceMinor: 0 },
  { slug: "bump-7d", en: "Boost for 7 days", he: "הקפצה ל-7 ימים", durationHours: 168, priceMinor: 0 },
];

export const badgeSeed: (Named & {
  slug: string;
  descEn: string;
  descHe: string;
  icon: string;
  target: number;
  showOnProfile: boolean;
})[] = [
  {
    slug: "frequent-uploads",
    en: "Fresh drops weekly",
    he: "חדש בארון כל שבוע",
    descEn: "Puts something new in the closet every week",
    descHe: "מעלה משהו חדש לארון בכל שבוע",
    icon: "sparkles",
    target: 4,
    showOnProfile: true,
  },
  {
    slug: "speedy-shipping",
    en: "Sends within a day",
    he: "שולח/ת תוך יום",
    descEn: "Usually posts an order within a day or two",
    descHe: "בדרך כלל שולח/ת הזמנה תוך יום או יומיים",
    icon: "zap",
    target: 5,
    showOnProfile: true,
  },
  {
    slug: "first-sale",
    en: "First sale",
    he: "המכירה הראשונה",
    descEn: "Sold the first item",
    descHe: "מכרת את הפריט הראשון",
    icon: "party-popper",
    target: 1,
    showOnProfile: false,
  },
  {
    slug: "ten-sales",
    en: "10 sales",
    he: "10 מכירות",
    descEn: "Completed 10 sales",
    descHe: "השלמת 10 מכירות",
    icon: "trophy",
    target: 10,
    showOnProfile: false,
  },
  {
    slug: "five-star-seller",
    en: "Loved by buyers",
    he: "אהוב/ה על הקונים",
    descEn: "Keeps an average of 4.8 or more over 10 reviews",
    descHe: "ממוצע של 4.8 ומעלה על פני 10 ביקורות",
    icon: "award",
    target: 10,
    showOnProfile: true,
  },
  {
    slug: "profile-complete",
    en: "Complete profile",
    he: "פרופיל מלא",
    descEn: "Added a photo, a bio and a city",
    descHe: "הוספת תמונה, תיאור ועיר",
    icon: "badge-check",
    target: 3,
    showOnProfile: false,
  },
  {
    slug: "eco-hero",
    en: "Eco hero",
    he: "גיבור/ת מחזור",
    descEn: "Bought 10 second hand items",
    descHe: "קנית 10 פריטי יד שנייה",
    icon: "leaf",
    target: 10,
    showOnProfile: false,
  },
];
