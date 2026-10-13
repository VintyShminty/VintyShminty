import { describe, expect, it } from "vitest";
import {
  createOrderInputSchema,
  createReviewInputSchema,
  offerInputSchema,
  quoteInputSchema,
  withdrawalInputSchema,
} from "./orders.js";

const id = "6f4f4b0e-65d4-4a4e-9b7d-2a8f9a0d3c11";

describe("order input schemas", () => {
  it("wants exactly one thing to buy", () => {
    expect(quoteInputSchema.safeParse({ listingId: id }).success).toBe(true);
    expect(quoteInputSchema.safeParse({ bundleId: id }).success).toBe(true);
    expect(quoteInputSchema.safeParse({}).success).toBe(false);
    expect(quoteInputSchema.safeParse({ listingId: id, offerId: id }).success).toBe(false);
    expect(createOrderInputSchema.safeParse({ offerId: id, deliveryMethod: "home" }).success).toBe(true);
    expect(createOrderInputSchema.safeParse({ listingId: id }).success).toBe(false);
    expect(createOrderInputSchema.safeParse({ listingId: id, deliveryMethod: "drone" }).success).toBe(false);
  });

  it("keeps money to whole positive minor units", () => {
    for (const schema of [offerInputSchema, withdrawalInputSchema]) {
      expect(schema.safeParse({ amountMinor: 5000 }).success).toBe(true);
      expect(schema.safeParse({ amountMinor: 0 }).success).toBe(false);
      expect(schema.safeParse({ amountMinor: -1 }).success).toBe(false);
      expect(schema.safeParse({ amountMinor: 10.5 }).success).toBe(false);
    }
  });

  it("limits stars and the comment, and trims it", () => {
    expect(createReviewInputSchema.safeParse({ rating: 5 }).success).toBe(true);
    expect(createReviewInputSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(createReviewInputSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(createReviewInputSchema.safeParse({ rating: 4, comment: "x".repeat(401) }).success).toBe(false);
    expect(createReviewInputSchema.parse({ rating: 4, comment: "  nice  " }).comment).toBe("nice");
    expect(createReviewInputSchema.parse({ rating: 4, comment: "   " }).comment).toBeUndefined();
  });
});
