/**
 * Single source of truth for every fixed list of values.
 * The database enums (packages/db) and the zod schemas (this package) are both built from these arrays.
 */

export const LOCALES = ["en", "he"] as const;
export type Locale = (typeof LOCALES)[number];

export const USER_ROLES = ["user", "moderator", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LISTING_STATUSES = ["draft", "active", "reserved", "sold", "hidden", "removed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ATTRIBUTE_MODES = ["required", "optional", "hidden"] as const;
export type AttributeMode = (typeof ATTRIBUTE_MODES)[number];

export const SIZE_KINDS = ["letter", "numeric", "shoe", "kids_age", "waist", "one_size"] as const;
export type SizeKind = (typeof SIZE_KINDS)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_EVENTS = [
  "create",
  "pay",
  "ship",
  "deliver",
  "confirm_received",
  "auto_complete",
  "cancel",
  "open_dispute",
  "refund",
  "release",
] as const;
export type OrderEvent = (typeof ORDER_EVENTS)[number];

export const ORDER_CANCEL_REASONS = [
  "buyer_cancelled",
  "seller_cancelled",
  "payment_failed",
  "payment_expired",
  "shipping_timeout",
  "item_unavailable",
  "other",
] as const;
export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

export const ACTOR_ROLES = ["buyer", "seller", "system", "admin"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export const DELIVERY_METHODS = ["pickup_point", "home"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const OFFER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "countered",
  "withdrawn",
  "expired",
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_EVENTS = ["accept", "decline", "counter", "withdraw", "expire"] as const;
export type OfferEvent = (typeof OFFER_EVENTS)[number];

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  "pending",
  "label_created",
  "in_transit",
  "delivered",
  "returned",
  "cancelled",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const MESSAGE_KINDS = ["text", "photo", "offer", "system"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/**
 * What the AI chat check warns about (D-041), the most serious first. The person who receives the message sees a quiet
 * warning under it. The AI never blocks or deletes a message.
 */
export const CHAT_WARNING_KINDS = [
  "off_platform_payment",
  "suspicious_link",
  "off_platform_contact",
  "pressure",
] as const;
export type ChatWarningKind = (typeof CHAT_WARNING_KINDS)[number];

export const SYSTEM_MESSAGE_EVENTS = [
  "order_paid",
  "order_shipped",
  "order_delivered",
  "order_completed",
  "order_cancelled",
  "order_disputed",
  "order_refunded",
  "review_auto_left",
  "offer_accepted",
  "offer_declined",
  "offer_countered",
  "offer_expired",
  "offer_withdrawn",
] as const;
export type SystemMessageEvent = (typeof SYSTEM_MESSAGE_EVENTS)[number];

export const NOTIFICATION_TYPES = [
  "new_message",
  "new_offer",
  "offer_accepted",
  "offer_declined",
  "offer_countered",
  "offer_expired",
  "listing_favourited",
  "favourite_sold",
  "favourite_price_drop",
  "new_follower",
  "followed_seller_new_item",
  "saved_search_match",
  "order_paid",
  "order_shipped",
  "order_delivered",
  "order_completed",
  "order_cancelled",
  "review_received",
  "review_reminder",
  "balance_released",
  "referral_rewarded",
  "listing_removed",
  "bump_ended",
  "platform_message",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["push", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const PUSH_PLATFORMS = ["ios", "android"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** `order` is only written by the AI order summary (D-044): members cannot report an order, they open a problem on it. */
export const REPORT_TARGETS = ["listing", "user", "message", "review", "order"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  "counterfeit",
  "prohibited_item",
  "misleading",
  "inappropriate",
  "spam",
  "harassment",
  "scam_off_platform",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Who raised a report: a member, or the AI listing check (D-038). The AI never acts, it only adds to Eden's list. */
export const REPORT_SOURCES = ["member", "ai_check"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

/** How soon a report needs a look, set by the AI (D-038). Null when the AI was off. */
export const REPORT_URGENCIES = ["high", "normal", "low"] as const;
export type ReportUrgency = (typeof REPORT_URGENCIES)[number];

export const WALLET_ENTRY_TYPES = [
  "sale_credit",
  "withdrawal",
  "balance_spend",
  "refund",
  "referral_bonus",
  "adjustment",
] as const;
export type WalletEntryType = (typeof WALLET_ENTRY_TYPES)[number];

export const WALLET_ENTRY_STATUSES = ["pending", "available", "void"] as const;
export type WalletEntryStatus = (typeof WALLET_ENTRY_STATUSES)[number];

export const BUNDLE_STATUSES = ["open", "ordered", "abandoned"] as const;
export type BundleStatus = (typeof BUNDLE_STATUSES)[number];

export const REVIEW_ROLES = ["buyer", "seller"] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];

export const REFERRAL_STATUSES = ["pending", "qualified", "rewarded", "void"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const VOUCHER_STATUSES = ["active", "used", "expired"] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export const LISTING_SORTS = ["relevance", "newest", "price_asc", "price_desc"] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

/** Things the feed learns from (Milestone 7). The weights live in `recommendations.ts`. */
export const USER_EVENT_TYPES = [
  "purchase",
  "offer",
  "message_seller",
  "favourite",
  "unfavourite",
  "save_search",
  "onboarding_pick",
  "listing_open_repeat",
  "listing_open",
  "listing_dwell",
  "search",
  "category_visit",
  "not_interested",
  "impression",
] as const;
export type UserEventType = (typeof USER_EVENT_TYPES)[number];

/** Where a card was shown. */
export const FEED_SURFACES = ["home", "search", "browse"] as const;
export type FeedSurface = (typeof FEED_SURFACES)[number];

/** What a taste score is about. */
export const AFFINITY_FEATURES = [
  "category",
  "parent_category",
  "brand",
  "seller",
  "size",
  "price_band",
  "colour",
  "condition",
  "style",
] as const;
export type AffinityFeature = (typeof AFFINITY_FEATURES)[number];

/** What "Not interested" hides. */
export const FEED_HIDE_SCOPES = ["item", "seller", "brand", "category"] as const;
export type FeedHideScope = (typeof FEED_HIDE_SCOPES)[number];

/** Switches an admin can flip. Only these names are accepted (routes/admin.ts). "ai" is the master AI switch. */
export const KILL_SWITCH_NAMES = ["ai"] as const;
export type KillSwitchName = (typeof KILL_SWITCH_NAMES)[number];

/** Currencies a fixed monthly cost can be entered in. Totals are shown in ILS. */
export const EXPENSE_CURRENCIES = ["ILS", "USD"] as const;
export type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number];

/** A fixed cost is either a subscription (a plan we pay for) or a configured amount (a number we typed in). */
export const EXPENSE_KINDS = ["subscription", "configured"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

/**
 * Style tags (D-042). Claude Haiku gives each listing up to 3 of these, behind the scenes only: nobody sees them, Home
 * learns from them like it learns brands and sizes. Narrow trends fold into a broad tag (coquette into romantic,
 * gorpcore into outdoor) so each tag holds enough items to learn from. Changing the list means tagging again.
 */
export const LISTING_STYLES = [
  "vintage",
  "y2k",
  "streetwear",
  "minimal",
  "classic",
  "quiet_luxury",
  "boho",
  "cottagecore",
  "romantic",
  "sporty",
  "outdoor",
  "preppy",
  "grunge",
  "goth",
  "western",
  "evening",
  "workwear",
  "summer",
  "modest",
  "basics",
] as const;
export type ListingStyle = (typeof LISTING_STYLES)[number];

/** The most style tags one listing gets. */
export const LISTING_STYLES_MAX = 3;
