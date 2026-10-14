import { describe, expect, it } from "vitest";
import { areOffersClosed, effectiveOfferStatus, offerAmountProblem, quickOfferAmount } from "./order-flow.js";

describe("offer rules", () => {
  it("rounds the quick tiles to whole shekels", () => {
    expect(quickOfferAmount(10000, 10)).toBe(9000);
    expect(quickOfferAmount(4550, 20)).toBe(3600);
  });
  it("wants an amount above zero and below the price", () => {
    expect(offerAmountProblem(null, 5000)).toBeNull();
    expect(offerAmountProblem(0, 5000)).toBe("positive");
    expect(offerAmountProblem(5000, 5000)).toBe("belowPrice");
    expect(offerAmountProblem(4900, 5000)).toBeNull();
  });
  it("treats a late pending or accepted offer as expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const later = new Date(Date.now() + 60_000).toISOString();
    expect(effectiveOfferStatus({ status: "pending", expiresAt: past })).toBe("expired");
    expect(effectiveOfferStatus({ status: "declined", expiresAt: past })).toBe("declined");
    expect(effectiveOfferStatus({ status: "accepted", expiresAt: later })).toBe("accepted");
  });
  it("closes offers once the item is sold or an order is paid", () => {
    expect(areOffersClosed("sold", undefined)).toBe(true);
    expect(areOffersClosed("reserved", "paid")).toBe(true);
    expect(areOffersClosed("reserved", "pending_payment")).toBe(false);
    expect(areOffersClosed("active", "cancelled")).toBe(false);
  });
});
