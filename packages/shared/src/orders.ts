import { z } from "zod";
import { idSchema, isoDateTimeSchema, pageSchema, paginationQuerySchema } from "./common.js";
import {
  DELIVERY_METHODS,
  ORDER_CANCEL_REASONS,
  ORDER_EVENTS,
  ORDER_STATUSES,
  SHIPMENT_STATUSES,
  WALLET_ENTRY_STATUSES,
  WALLET_ENTRY_TYPES,
} from "./enums.js";
import { reviewItemSchema } from "./reviews.js";
import { addressSchema, userSummarySchema } from "./users.js";

const currencySchema = z.string().length(3);
const amountSchema = z.number().int().positive().max(2_000_000_000);

// ---- Offers ----

/** An offer or counter offer. Also the shape of the offer inside an offer bubble (plus the ids). */
export const offerSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  listingId: idSchema,
  buyerId: idSchema,
  sellerId: idSchema,
  /** Who made this offer. The other person answers it. */
  offeredById: idSchema,
  /** The offer this one counters, if any. */
  parentOfferId: idSchema.nullable(),
  amountMinor: z.number().int(),
  currency: currencySchema,
  listingPriceMinor: z.number().int(),
  status: z.enum(["pending", "accepted", "declined", "countered", "withdrawn", "expired"]),
  /** A pending offer expires here. An accepted offer must be checked out before this. */
  expiresAt: isoDateTimeSchema,
  respondedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  /** Filled while the listing is held for the buyer because of this accepted offer. */
  reservedUntil: isoDateTimeSchema.nullable(),
});
export type Offer = z.infer<typeof offerSchema>;

/** POST /v1/conversations/:id/offers and POST /v1/offers/:id/counter */
export const offerInputSchema = z.object({ amountMinor: amountSchema });
export type OfferInput = z.infer<typeof offerInputSchema>;

/** GET /v1/offers/quota. The "N offers left for today" line. */
export const offerQuotaSchema = z.object({
  limit: z.number().int(),
  remaining: z.number().int(),
  /** When the next offer slot frees up. */
  resetsAt: isoDateTimeSchema,
});
export type OfferQuota = z.infer<typeof offerQuotaSchema>;

// ---- Bundles ----

export const bundleTierSchema = z.object({
  minItems: z.number().int(),
  percentOff: z.number().int(),
});

export const bundleItemSchema = z.object({
  listingId: idSchema,
  title: z.string(),
  status: z.enum(["draft", "active", "reserved", "sold", "hidden", "removed"]),
  priceMinor: z.number().int(),
  photoUrl: z.string().url().nullable(),
});

export const bundleSchema = z.object({
  id: idSchema,
  seller: userSummarySchema,
  status: z.enum(["open", "ordered", "abandoned"]),
  currency: currencySchema,
  items: z.array(bundleItemSchema),
  itemCount: z.number().int(),
  subtotalMinor: z.number().int(),
  discountPercent: z.number().int(),
  discountMinor: z.number().int(),
  /** Items after the discount, before the protection fee and postage. */
  netMinor: z.number().int(),
  /** The next step of the seller's ladder, for "Add 2 items to get 5% off". Null at the top of the ladder. */
  nextTier: z.object({ addItems: z.number().int(), percentOff: z.number().int() }).nullable(),
  tiers: z.array(bundleTierSchema),
  /** Sum of each item's own parcel price, what separate orders would cost in postage. */
  postageSeparateMinor: z.number().int(),
  /** The one parcel a bundle pays (the biggest parcel). */
  postageTogetherMinor: z.number().int(),
});
export type Bundle = z.infer<typeof bundleSchema>;

/** What a bundle saves the buyer: the discount plus the postage of the parcels that no longer ship separately. */
export function bundleSavedMinor(
  b: Pick<Bundle, "discountMinor" | "postageSeparateMinor" | "postageTogetherMinor">,
): number {
  return b.discountMinor + Math.max(0, b.postageSeparateMinor - b.postageTogetherMinor);
}

/** A seller's ladder as the item page, the profile and Settings read it. Off means no discount at all. */
export const bundleLadderSchema = z.object({
  on: z.boolean(),
  tiers: z.array(bundleTierSchema),
});
export type BundleLadder = z.infer<typeof bundleLadderSchema>;

export const BUNDLE_LADDER_MAX_STEPS = 5;
export const BUNDLE_MIN_ITEMS_LIMIT = 20;
export const BUNDLE_MAX_PERCENT = 50;

/** What a seller saves: 1 to 5 steps, items from 2 to 20 and percent from 1 to 50, both growing step by step. */
export const updateBundleLadderInputSchema = z
  .object({
    on: z.boolean(),
    tiers: z
      .array(
        z.object({
          minItems: z.number().int().min(2).max(BUNDLE_MIN_ITEMS_LIMIT),
          percentOff: z.number().int().min(1).max(BUNDLE_MAX_PERCENT),
        }),
      )
      .min(1)
      .max(BUNDLE_LADDER_MAX_STEPS),
  })
  .superRefine((v, ctx) => {
    for (let i = 1; i < v.tiers.length; i++) {
      const a = v.tiers[i - 1];
      const b = v.tiers[i];
      if (a && b && (b.minItems <= a.minItems || b.percentOff <= a.percentOff)) {
        ctx.addIssue({
          code: "custom",
          message: "Each step needs more items and a bigger discount",
          path: ["tiers", i],
        });
      }
    }
  });
export type UpdateBundleLadderInput = z.infer<typeof updateBundleLadderInputSchema>;

export const createBundleInputSchema = z.object({ sellerId: idSchema });
export const openBundleQuerySchema = z.object({ sellerId: idSchema });
export const bundleParamsSchema = z.object({ id: idSchema, listingId: idSchema });

// ---- Checkout ----

const targetShape = {
  listingId: idSchema.optional(),
  bundleId: idSchema.optional(),
  offerId: idSchema.optional(),
};
const oneTarget = (v: { listingId?: string; bundleId?: string; offerId?: string }) =>
  [v.listingId, v.bundleId, v.offerId].filter(Boolean).length === 1;
const ONE_TARGET = { message: "Give exactly one of listingId, bundleId or offerId" };

export const quoteInputSchema = z
  .object({ ...targetShape, deliveryMethod: z.enum(DELIVERY_METHODS).optional() })
  .refine(oneTarget, ONE_TARGET);
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const createOrderInputSchema = z
  .object({
    ...targetShape,
    deliveryMethod: z.enum(DELIVERY_METHODS),
    /** Needed for home delivery. For pickup point it is optional in version 1 (there is no pickup point picker yet). */
    addressId: idSchema.nullish(),
  })
  .refine(oneTarget, ONE_TARGET);
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

/** The optional Idempotency-Key header (orders, pay, withdrawals). */
export const idempotencyHeadersSchema = z.object({
  "idempotency-key": z.string().trim().min(8).max(120).optional(),
});

export const orderLineSchema = z.object({
  listingId: idSchema.nullable(),
  title: z.string(),
  brand: z.string().nullable(),
  size: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  priceMinor: z.number().int(),
});

export const orderTotalsSchema = z.object({
  itemsSubtotalMinor: z.number().int(),
  bundleDiscountPercent: z.number().int(),
  bundleDiscountMinor: z.number().int(),
  buyerProtectionFeeMinor: z.number().int(),
  shippingMinor: z.number().int(),
  voucherDiscountMinor: z.number().int(),
  totalMinor: z.number().int(),
  currency: currencySchema,
});

/** POST /v1/checkout/quote */
export const checkoutQuoteSchema = orderTotalsSchema.extend({
  sellerId: idSchema,
  offerId: idSchema.nullable(),
  bundleId: idSchema.nullable(),
  /** Postage a bundle saves against sending every item on its own. 0 when there is no saving. */
  postageSavedMinor: z.number().int(),
  items: z.array(orderLineSchema),
  deliveryMethod: z.enum(DELIVERY_METHODS),
  deliveryOptions: z.array(
    z.object({ method: z.enum(DELIVERY_METHODS), priceMinor: z.number().int(), available: z.boolean() }),
  ),
  /** How long the item is held once the order is created, in minutes. */
  holdMinutes: z.number().int(),
});
export type CheckoutQuote = z.infer<typeof checkoutQuoteSchema>;

// ---- Orders ----

export const ORDER_STATUS_FILTERS = ["all", "in_progress", "cancelled", "completed"] as const;
export const ORDER_ROLES = ["bought", "sold"] as const;

export const ordersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(ORDER_ROLES).default("bought"),
  status: z.enum(ORDER_STATUS_FILTERS).default("all"),
});

/** One row of My orders. */
export const orderRowSchema = z.object({
  id: idSchema,
  orderNumber: z.number().int(),
  /** Which side the signed in person is on. */
  role: z.enum(["buyer", "seller"]),
  status: z.enum(ORDER_STATUSES),
  otherUser: userSummarySchema,
  conversationId: idSchema.nullable(),
  /** Title and cover of the first item, and how many there are. */
  title: z.string(),
  photoUrl: z.string().url().nullable(),
  itemCount: z.number().int(),
  currency: currencySchema,
  totalMinor: z.number().int(),
  /** What the seller earns. Only the seller sees it (null for the buyer). */
  sellerEarningsMinor: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type OrderRow = z.infer<typeof orderRowSchema>;
export const orderPageSchema = pageSchema(orderRowSchema);

export const orderPaymentSchema = z.object({
  provider: z.string(),
  /** True in version 1: no card was asked for and no money moved. */
  simulated: z.boolean(),
  status: z.enum(["pending", "succeeded", "failed", "refunded"]),
  method: z.string(),
  amountMinor: z.number().int(),
  currency: currencySchema,
  paidAt: isoDateTimeSchema.nullable(),
  refundedAt: isoDateTimeSchema.nullable(),
});

export const orderShipmentSchema = z.object({
  provider: z.string(),
  simulated: z.boolean(),
  status: z.enum(SHIPMENT_STATUSES),
  carrier: z.string().nullable(),
  trackingCode: z.string().nullable(),
  shippedAt: isoDateTimeSchema.nullable(),
  deliveredAt: isoDateTimeSchema.nullable(),
});

export const orderTimelineEventSchema = z.object({
  id: idSchema,
  event: z.enum(ORDER_EVENTS),
  fromStatus: z.enum(ORDER_STATUSES).nullable(),
  toStatus: z.enum(ORDER_STATUSES),
  actorRole: z.enum(["buyer", "seller", "system", "admin"]),
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export const ORDER_ACTIONS = ["pay", "cancel", "ship", "confirm_received", "open_dispute"] as const;

export const orderDetailSchema = orderRowSchema.extend({
  buyer: userSummarySchema,
  seller: userSummarySchema,
  offerId: idSchema.nullable(),
  bundleId: idSchema.nullable(),
  items: z.array(orderLineSchema),
  itemsSubtotalMinor: z.number().int(),
  bundleDiscountMinor: z.number().int(),
  buyerProtectionFeeMinor: z.number().int(),
  shippingMinor: z.number().int(),
  voucherDiscountMinor: z.number().int(),
  deliveryMethod: z.enum(DELIVERY_METHODS),
  /** The address as it was at checkout. Null for a pickup point order without an address. */
  shippingAddress: addressSchema.omit({ id: true }).nullable(),
  payment: orderPaymentSchema.nullable(),
  shipment: orderShipmentSchema.nullable(),
  timeline: z.array(orderTimelineEventSchema),
  cancelReason: z.enum(ORDER_CANCEL_REASONS).nullable(),
  /** Pay before this or the item goes back on sale. Only while the order waits for payment. */
  payByAt: isoDateTimeSchema.nullable(),
  /** The seller must ship before this. */
  shipByAt: isoDateTimeSchema.nullable(),
  autoCompleteAt: isoDateTimeSchema.nullable(),
  paidAt: isoDateTimeSchema.nullable(),
  shippedAt: isoDateTimeSchema.nullable(),
  deliveredAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  /** The buttons this person can use right now. */
  actions: z.array(z.enum(ORDER_ACTIONS)),
  /** True when the order is completed and this person has not left feedback yet. */
  canReview: z.boolean(),
  reviews: z.object({
    mine: reviewItemSchema.nullable(),
    theirs: reviewItemSchema.nullable(),
  }),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const cancelOrderInputSchema = z.object({ reason: z.string().trim().max(300).optional() });
export const disputeOrderInputSchema = z.object({ details: z.string().trim().min(1).max(1000) });
export const adminOrderNoteInputSchema = z.object({ note: z.string().trim().max(500).optional() });

// ---- Reviews ----

export const REVIEW_COMMENT_MAX = 400;
export const createReviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX)
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export const replyInputSchema = z.object({ body: z.string().trim().min(1).max(REVIEW_COMMENT_MAX) });

// ---- Balance ----

export const balanceSchema = z.object({
  pending: z.number().int(),
  available: z.number().int(),
  currency: currencySchema,
});
export type Balance = z.infer<typeof balanceSchema>;

export const balanceEntrySchema = z.object({
  id: idSchema,
  type: z.enum(WALLET_ENTRY_TYPES),
  status: z.enum(WALLET_ENTRY_STATUSES),
  /** Signed: negative for withdrawals. */
  amountMinor: z.number().int(),
  currency: currencySchema,
  description: z.string().nullable(),
  orderId: idSchema.nullable(),
  orderNumber: z.number().int().nullable(),
  /** Calendar month of `createdAt` in UTC, "2026-10". The app groups the list by it. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  createdAt: isoDateTimeSchema,
  availableAt: isoDateTimeSchema.nullable(),
});
export type BalanceEntry = z.infer<typeof balanceEntrySchema>;
export const balanceEntryPageSchema = pageSchema(balanceEntrySchema);

export const withdrawalInputSchema = z.object({ amountMinor: amountSchema });
