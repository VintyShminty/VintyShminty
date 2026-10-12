import { z } from "zod";

/**
 * The buyer protection fee is data (a row in the fee_rules table), not a constant.
 * In version 1 the fee is calculated and shown but nothing is charged.
 * Spec reference: about 5% plus 0.70 EUR, so 500 basis points and a fixed part.
 */
export const feeRuleSchema = z.object({
  id: z.string().uuid().optional(),
  currency: z.string().length(3),
  /** 100 basis points = 1%. */
  buyerFeeBasisPoints: z.number().int().min(0).max(10_000),
  buyerFeeFixedMinor: z.number().int().min(0),
});
export type FeeRule = z.infer<typeof feeRuleSchema>;

/** Half up rounding on integer maths, so results never depend on floating point. */
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** Buyer protection fee on an items subtotal (after any bundle discount). */
export function calculateBuyerProtectionFee(
  itemsSubtotalMinor: number,
  rule: Pick<FeeRule, "buyerFeeBasisPoints" | "buyerFeeFixedMinor">,
): number {
  if (itemsSubtotalMinor <= 0) return 0;
  return roundDiv(itemsSubtotalMinor * rule.buyerFeeBasisPoints, 10_000) + rule.buyerFeeFixedMinor;
}

export interface OrderTotalsInput {
  /** Price of each item in minor units. */
  itemPricesMinor: number[];
  /** Bundle discount as a whole percent (0 to 100). */
  bundleDiscountPercent?: number;
  shippingMinor?: number;
  voucherDiscountMinor?: number;
  feeRule: Pick<FeeRule, "buyerFeeBasisPoints" | "buyerFeeFixedMinor">;
}

export interface OrderTotals {
  itemsSubtotalMinor: number;
  bundleDiscountMinor: number;
  /** Items after the bundle discount. This is what the seller earns. */
  itemsNetMinor: number;
  buyerProtectionFeeMinor: number;
  shippingMinor: number;
  voucherDiscountMinor: number;
  /** What the buyer would pay. */
  totalMinor: number;
  /** What the seller earns (selling is free, so it equals itemsNetMinor). */
  sellerEarningsMinor: number;
}

export function calculateOrderTotals(input: OrderTotalsInput): OrderTotals {
  const itemsSubtotalMinor = input.itemPricesMinor.reduce((sum, p) => sum + p, 0);
  const percent = Math.min(100, Math.max(0, input.bundleDiscountPercent ?? 0));
  const bundleDiscountMinor = roundDiv(itemsSubtotalMinor * percent, 100);
  const itemsNetMinor = itemsSubtotalMinor - bundleDiscountMinor;
  const buyerProtectionFeeMinor = calculateBuyerProtectionFee(itemsNetMinor, input.feeRule);
  const shippingMinor = input.shippingMinor ?? 0;
  const gross = itemsNetMinor + buyerProtectionFeeMinor + shippingMinor;
  const voucherDiscountMinor = Math.min(input.voucherDiscountMinor ?? 0, gross);
  return {
    itemsSubtotalMinor,
    bundleDiscountMinor,
    itemsNetMinor,
    buyerProtectionFeeMinor,
    shippingMinor,
    voucherDiscountMinor,
    totalMinor: gross - voucherDiscountMinor,
    sellerEarningsMinor: itemsNetMinor,
  };
}

/** The "incl. fee" price shown on cards: the item price plus the protection fee, no shipping. */
export function buyerPriceMinor(
  itemPriceMinor: number,
  rule: Pick<FeeRule, "buyerFeeBasisPoints" | "buyerFeeFixedMinor">,
): number {
  return itemPriceMinor + calculateBuyerProtectionFee(itemPriceMinor, rule);
}
