import { describe, expect, it } from "vitest";
import {
  bundleDiscountPercentFor,
  buyerPriceMinor,
  calculateBuyerProtectionFee,
  calculateOrderTotals,
  DEFAULT_BUNDLE_LADDER,
  nextBundleTier,
} from "./fees.js";
import { formatMoney, fromMinorUnits, toMinorUnits } from "./money.js";

// The spec rule: about 5% plus 0.70 in the spec's currency.
const rule = { buyerFeeBasisPoints: 500, buyerFeeFixedMinor: 70 };

describe("buyer protection fee", () => {
  it("matches the spec examples (5 and 8 and 30 and 50)", () => {
    expect(calculateBuyerProtectionFee(500, rule)).toBe(95);
    expect(calculateBuyerProtectionFee(800, rule)).toBe(110);
    expect(calculateBuyerProtectionFee(3000, rule)).toBe(220);
    expect(calculateBuyerProtectionFee(5000, rule)).toBe(320);
  });

  it("rounds half up on whole minor units", () => {
    // 5% of 1010 is 50.5, so 51 plus 70
    expect(calculateBuyerProtectionFee(1010, rule)).toBe(121);
  });

  it("is zero for a free item", () => {
    expect(calculateBuyerProtectionFee(0, rule)).toBe(0);
  });

  it("adds to the item price for the card price", () => {
    expect(buyerPriceMinor(3000, rule)).toBe(3220);
  });
});

describe("order totals", () => {
  it("adds fee and shipping to one item", () => {
    const totals = calculateOrderTotals({ itemPricesMinor: [10_000], shippingMinor: 2_500, feeRule: rule });
    expect(totals.buyerProtectionFeeMinor).toBe(570);
    expect(totals.totalMinor).toBe(13_070);
    expect(totals.sellerEarningsMinor).toBe(10_000);
  });

  it("applies the bundle discount before the fee", () => {
    const totals = calculateOrderTotals({
      itemPricesMinor: [4_000, 6_000],
      bundleDiscountPercent: 5,
      feeRule: rule,
    });
    expect(totals.itemsSubtotalMinor).toBe(10_000);
    expect(totals.bundleDiscountMinor).toBe(500);
    expect(totals.itemsNetMinor).toBe(9_500);
    expect(totals.buyerProtectionFeeMinor).toBe(545);
    expect(totals.totalMinor).toBe(10_045);
    expect(totals.sellerEarningsMinor).toBe(9_500);
  });

  it("never lets a voucher push the total below zero", () => {
    const totals = calculateOrderTotals({
      itemPricesMinor: [1_000],
      voucherDiscountMinor: 50_000,
      feeRule: rule,
    });
    expect(totals.totalMinor).toBe(0);
    expect(totals.voucherDiscountMinor).toBe(1_000 + 120);
  });
});

describe("money helpers", () => {
  it("converts between major and minor units", () => {
    expect(toMinorUnits(12.5, "ILS")).toBe(1250);
    expect(fromMinorUnits(1250, "ILS")).toBe(12.5);
    expect(toMinorUnits(1200, "JPY")).toBe(1200);
  });

  it("formats with the currency symbol", () => {
    expect(formatMoney(12_500, "ILS", "en")).toContain("125.00");
  });
});

describe("bundle ladder", () => {
  const tiers = [
    { minItems: 2, percentOff: 5 },
    { minItems: 3, percentOff: 10 },
    { minItems: 5, percentOff: 15 },
  ];
  it("picks the best step the item count reaches", () => {
    expect(bundleDiscountPercentFor(tiers, 1)).toBe(0);
    expect(bundleDiscountPercentFor(tiers, 2)).toBe(5);
    expect(bundleDiscountPercentFor(tiers, 4)).toBe(10);
    expect(bundleDiscountPercentFor(tiers, 9)).toBe(15);
    expect(bundleDiscountPercentFor([], 4)).toBe(0);
  });
  it("says how many more items reach the next step", () => {
    expect(nextBundleTier(tiers, 1)).toEqual({ addItems: 1, percentOff: 5 });
    expect(nextBundleTier(tiers, 3)).toEqual({ addItems: 2, percentOff: 15 });
    expect(nextBundleTier(tiers, 5)).toBeNull();
  });
});

describe("default bundle ladder", () => {
  it("gives 5, 10 and 15 percent at 2, 3 and 5 items", () => {
    expect(bundleDiscountPercentFor(DEFAULT_BUNDLE_LADDER, 1)).toBe(0);
    expect(bundleDiscountPercentFor(DEFAULT_BUNDLE_LADDER, 2)).toBe(5);
    expect(bundleDiscountPercentFor(DEFAULT_BUNDLE_LADDER, 4)).toBe(10);
    expect(bundleDiscountPercentFor(DEFAULT_BUNDLE_LADDER, 5)).toBe(15);
  });
});
