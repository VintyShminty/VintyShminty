import {
  ACTOR_ROLES,
  DELIVERY_METHODS,
  ORDER_CANCEL_REASONS,
  ORDER_EVENTS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  REFERRAL_STATUSES,
  REVIEW_ROLES,
  SHIPMENT_STATUSES,
  VOUCHER_STATUSES,
  WALLET_ENTRY_STATUSES,
  WALLET_ENTRY_TYPES,
} from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currencyCol, pk, ts, updatedAt } from "./_helpers.js";
import { users } from "./auth.js";
import { conversations, offers } from "./conversations.js";
import { bundles, listings } from "./listings.js";
import { addresses } from "./people.js";
import { currencies, feeRules, parcelSizes } from "./reference.js";

export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const orderEventEnum = pgEnum("order_event", ORDER_EVENTS);
export const orderCancelReasonEnum = pgEnum("order_cancel_reason", ORDER_CANCEL_REASONS);
export const actorRoleEnum = pgEnum("actor_role", ACTOR_ROLES);
export const deliveryMethodEnum = pgEnum("delivery_method", DELIVERY_METHODS);
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);
export const shipmentStatusEnum = pgEnum("shipment_status", SHIPMENT_STATUSES);
export const reviewRoleEnum = pgEnum("review_role", REVIEW_ROLES);
export const walletEntryTypeEnum = pgEnum("wallet_entry_type", WALLET_ENTRY_TYPES);
export const walletEntryStatusEnum = pgEnum("wallet_entry_status", WALLET_ENTRY_STATUSES);
export const referralStatusEnum = pgEnum("referral_status", REFERRAL_STATUSES);
export const voucherStatusEnum = pgEnum("voucher_status", VOUCHER_STATUSES);

/** Credit a person receives, for example from the invite a friend programme. Applied at checkout. */
export const vouchers = pgTable(
  "vouchers",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("referral"),
    amountMinor: integer("amount_minor").notNull(),
    currency: currencyCol().references(() => currencies.code),
    /** The order must reach this items total for the voucher to apply. */
    minOrderMinor: integer("min_order_minor").notNull().default(0),
    status: voucherStatusEnum("status").notNull().default("active"),
    expiresAt: ts("expires_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("vouchers_amount_positive", sql`${t.amountMinor} > 0`),
    index("vouchers_user_idx").on(t.userId, t.status),
  ],
);

/**
 * An order is one checkout between one buyer and one seller for one or more listings.
 * Money columns are a snapshot taken at checkout so later fee or price changes never rewrite history.
 * Payment and shipping are simulated in version 1: payment_provider and shipping_provider say 'simulated'.
 */
export const orders = pgTable(
  "orders",
  {
    id: pk(),
    /** Short readable number for people, for example 1042. */
    orderNumber: integer("order_number").generatedAlwaysAsIdentity({ startWith: 1000 }).notNull().unique(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    bundleId: uuid("bundle_id").references(() => bundles.id, { onDelete: "set null" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    cancelReason: orderCancelReasonEnum("cancel_reason"),
    cancelledById: uuid("cancelled_by_id").references(() => users.id, { onDelete: "set null" }),
    currency: currencyCol().references(() => currencies.code),
    itemsSubtotalMinor: integer("items_subtotal_minor").notNull(),
    bundleDiscountMinor: integer("bundle_discount_minor").notNull().default(0),
    buyerProtectionFeeMinor: integer("buyer_protection_fee_minor").notNull().default(0),
    shippingMinor: integer("shipping_minor").notNull().default(0),
    voucherDiscountMinor: integer("voucher_discount_minor").notNull().default(0),
    /** What the buyer pays. Shown, never charged in version 1. */
    totalMinor: integer("total_minor").notNull(),
    /** What the seller earns once the order completes. */
    sellerEarningsMinor: integer("seller_earnings_minor").notNull(),
    feeRuleId: uuid("fee_rule_id").references(() => feeRules.id, { onDelete: "set null" }),
    feeBasisPoints: integer("fee_basis_points").notNull().default(0),
    feeFixedMinor: integer("fee_fixed_minor").notNull().default(0),
    deliveryMethod: deliveryMethodEnum("delivery_method").notNull().default("pickup_point"),
    parcelSizeId: uuid("parcel_size_id").references(() => parcelSizes.id, { onDelete: "set null" }),
    shippingAddressId: uuid("shipping_address_id").references(() => addresses.id, { onDelete: "set null" }),
    /** Copy of the address at checkout, because the saved address may change later. */
    shippingAddress: jsonb("shipping_address"),
    paymentProvider: text("payment_provider").notNull().default("simulated"),
    shippingProvider: text("shipping_provider").notNull().default("simulated"),
    paidAt: ts("paid_at"),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    /** The seller must ship before this or the order cancels itself. */
    shipByAt: ts("ship_by_at"),
    /** If the buyer does nothing, the order completes by itself at this time. */
    autoCompleteAt: ts("auto_complete_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "orders_money_nonneg",
      sql`${t.itemsSubtotalMinor} >= 0 and ${t.bundleDiscountMinor} >= 0 and ${t.buyerProtectionFeeMinor} >= 0 and ${t.shippingMinor} >= 0 and ${t.voucherDiscountMinor} >= 0 and ${t.totalMinor} >= 0 and ${t.sellerEarningsMinor} >= 0`,
    ),
    check("orders_not_self", sql`${t.buyerId} <> ${t.sellerId}`),
    check("orders_cancel_has_reason", sql`${t.status} <> 'cancelled' or ${t.cancelReason} is not null`),
    // My orders: Bought and Sold tabs, newest first, filtered by status chip.
    index("orders_buyer_idx").on(t.buyerId, t.status, t.createdAt.desc()),
    index("orders_seller_idx").on(t.sellerId, t.status, t.createdAt.desc()),
    index("orders_conversation_idx").on(t.conversationId),
    // Background jobs: expire unpaid, cancel unshipped, auto complete.
    index("orders_ship_by_idx").on(t.shipByAt).where(sql`${t.status} = 'paid'`),
    index("orders_auto_complete_idx")
      .on(t.autoCompleteAt)
      .where(sql`${t.status} in ('shipped', 'delivered')`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: pk(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Becomes null if the listing is ever deleted. The snapshot columns keep the history readable. */
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    priceMinor: integer("price_minor").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    brandSnapshot: text("brand_snapshot"),
    sizeSnapshot: text("size_snapshot"),
    photoKeySnapshot: text("photo_key_snapshot"),
    createdAt: createdAt(),
  },
  (t) => [
    check("order_items_price_nonneg", sql`${t.priceMinor} >= 0`),
    index("order_items_order_idx").on(t.orderId),
    index("order_items_listing_idx").on(t.listingId),
  ],
);

/** The timeline. One row each time an order moves. This is what the buyer and seller dividers are made from. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: pk(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    event: orderEventEnum("event").notNull(),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: actorRoleEnum("actor_role").notNull(),
    note: text("note"),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

/** Payment attempts. Version 1 writes one 'simulated' row that is always successful. */
export const payments = pgTable(
  "payments",
  {
    id: pk(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("simulated"),
    /** The provider's own id for this payment. Null for simulated. */
    providerRef: text("provider_ref"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountMinor: integer("amount_minor").notNull(),
    currency: currencyCol().references(() => currencies.code),
    method: text("method").notNull().default("simulated"),
    failureReason: text("failure_reason"),
    paidAt: ts("paid_at"),
    refundedAt: ts("refunded_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("payments_amount_nonneg", sql`${t.amountMinor} >= 0`),
    index("payments_order_idx").on(t.orderId),
    uniqueIndex("payments_provider_ref_unique")
      .on(t.provider, t.providerRef)
      .where(sql`${t.providerRef} is not null`),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: pk(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("simulated"),
    status: shipmentStatusEnum("status").notNull().default("pending"),
    carrier: text("carrier"),
    trackingCode: text("tracking_code"),
    /** Object storage key of the printable label, once real shipping exists. */
    labelKey: text("label_key"),
    parcelSizeId: uuid("parcel_size_id").references(() => parcelSizes.id, { onDelete: "set null" }),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("shipments_order_idx").on(t.orderId), index("shipments_tracking_idx").on(t.trackingCode)],
);

/**
 * Feedback after an order. Each side can review the other once per order.
 * An automatic review is created for the buyer when a sale completes. If the buyer writes their own,
 * the same row is updated and is_automatic becomes false.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: pk(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    revieweeId: uuid("reviewee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The role the reviewer had in the order. */
    reviewerRole: reviewRoleEnum("reviewer_role").notNull(),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    isAutomatic: boolean("is_automatic").notNull().default(false),
    /** Public reply by the reviewee. */
    replyBody: text("reply_body"),
    repliedAt: ts("replied_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("reviews_order_reviewer_unique").on(t.orderId, t.reviewerId),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    check("reviews_comment_length", sql`${t.comment} is null or char_length(${t.comment}) <= 400`),
    check("reviews_not_self", sql`${t.reviewerId} <> ${t.revieweeId}`),
    // Reviews tab on a profile, with the From members and Automatic chips.
    index("reviews_reviewee_idx").on(t.revieweeId, t.isAutomatic, t.createdAt.desc()),
  ],
);

/**
 * Money ledger. Append only: a row is never edited except to move from pending to available (or void).
 * Amounts are signed. Balance available = sum of available rows, pending = sum of pending rows.
 * Withdrawals are simulated rows too, no bank is contacted.
 */
export const walletEntries = pgTable(
  "wallet_entries",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: walletEntryTypeEnum("type").notNull(),
    status: walletEntryStatusEnum("status").notNull().default("pending"),
    amountMinor: integer("amount_minor").notNull(),
    currency: currencyCol().references(() => currencies.code),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    description: text("description"),
    availableAt: ts("available_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("wallet_entries_nonzero", sql`${t.amountMinor} <> 0`),
    index("wallet_entries_user_idx").on(t.userId, t.createdAt.desc()),
    index("wallet_entries_user_status_idx").on(t.userId, t.status),
    // One sale credit per order and one refund per order.
    uniqueIndex("wallet_entries_order_type_unique")
      .on(t.userId, t.orderId, t.type)
      .where(sql`${t.orderId} is not null`),
  ],
);

/** Invite a friend. Both sides get a voucher once the invited person completes their first order. */
export const referrals = pgTable(
  "referrals",
  {
    id: pk(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    status: referralStatusEnum("status").notNull().default("pending"),
    qualifiedAt: ts("qualified_at"),
    rewardedAt: ts("rewarded_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("referrals_inviter_idx").on(t.inviterId, t.createdAt.desc()),
    check("referrals_not_self", sql`${t.inviterId} <> ${t.inviteeId}`),
  ],
);
