import { z } from "zod";
import type { OrderStatus } from "./enums.js";
import type { Offer } from "./orders.js";

// Pure rules for offers and orders that the app and the website both show. Icons and colours stay in each app.

// ---- Offers ----

/** The quick offers: this much off the price, each tile shows the amount it works out to. */
export const QUICK_OFFER_PERCENT = [10, 20, 30] as const;

/** Whole shekels only for the quick tiles, so the numbers look like a person chose them. */
export function quickOfferAmount(priceMinor: number, percent: number): number {
  return Math.round((priceMinor * (100 - percent)) / 100 / 100) * 100;
}

export type OfferAmountProblem = "positive" | "belowPrice";

/** What is wrong with an offer amount, or null when it is fine. The server checks the same two rules. */
export function offerAmountProblem(
  amountMinor: number | null,
  listingPriceMinor: number,
): OfferAmountProblem | null {
  if (amountMinor === null) return null;
  if (amountMinor <= 0) return "positive";
  if (amountMinor >= listingPriceMinor) return "belowPrice";
  return null;
}

type OfferLike = Pick<Offer, "status" | "expiresAt">;

/** The server turns old offers into expired a little later. A bubble does not wait. */
export function effectiveOfferStatus(offer: OfferLike, now: number = Date.now()): Offer["status"] {
  const timedOut = new Date(offer.expiresAt).getTime() <= now;
  return (offer.status === "pending" || offer.status === "accepted") && timedOut ? "expired" : offer.status;
}

/** Once the item is sold or an order is paid, old offers are history. */
export function areOffersClosed(
  listingStatus: string | undefined,
  orderStatus: OrderStatus | undefined,
): boolean {
  return (
    listingStatus === "sold" ||
    Boolean(orderStatus && !["pending_payment", "cancelled", "refunded"].includes(orderStatus))
  );
}

// ---- Orders ----

export type StatusVariant = "accent" | "success" | "warning" | "error" | "neutral";

/** Colour family of the status pill. Each app adds its own icon, because status is never colour alone. */
export const ORDER_STATUS_VARIANT: Record<OrderStatus, StatusVariant> = {
  pending_payment: "warning",
  paid: "accent",
  shipped: "accent",
  delivered: "accent",
  completed: "success",
  cancelled: "error",
  disputed: "warning",
  refunded: "neutral",
};

/** Translation key of the plain words for a status, for this side of the order. */
export const orderStatusKey = (status: OrderStatus, role: "buyer" | "seller") =>
  `orders.status.${status}.${role}`;

/** The steps still to come on the happy path, by where the order is now. */
export const UPCOMING_ORDER_STEPS: Partial<Record<OrderStatus, string[]>> = {
  pending_payment: ["pay", "ship", "deliver", "complete"],
  paid: ["ship", "deliver", "complete"],
  shipped: ["deliver", "complete"],
  delivered: ["complete"],
};

// ---- Addresses ----

/** The address form's own checks. Messages are translation keys (`validation.address.*`). */
export const addressFormSchema = z.object({
  fullName: z.string().trim().min(1, "validation.address.fullName").max(100, "validation.address.tooLong"),
  line1: z.string().trim().min(1, "validation.address.line1").max(150, "validation.address.tooLong"),
  line2: z.string().trim().max(150, "validation.address.tooLong"),
  city: z.string().trim().min(1, "validation.address.city").max(80, "validation.address.tooLong"),
  postcode: z.string().trim().min(1, "validation.address.postcode").max(20, "validation.address.tooLong"),
  phone: z.string().trim().max(30, "validation.address.tooLong"),
  label: z.string().trim().max(40, "validation.address.tooLong"),
});
export type AddressFormValues = z.infer<typeof addressFormSchema>;
