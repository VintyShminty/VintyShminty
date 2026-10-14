import { describe, expect, it } from "vitest";
import {
  applyUnderstanding,
  EMPTY_SEARCH_UNDERSTANDING,
  searchNeedsUnderstanding,
  searchUnderstandingSchema,
} from "./search-assist.js";

const a = "0b5f3c9e-6d2a-4f6e-9b1c-3a7d5e8f1a2a";
const b = "0b5f3c9e-6d2a-4f6e-9b1c-3a7d5e8f1a2b";

describe("search in plain words", () => {
  it("only sends sentences or numbers to the AI", () => {
    expect(searchNeedsUnderstanding("Zara")).toBe(false);
    expect(searchNeedsUnderstanding("linen shirt")).toBe(false);
    expect(searchNeedsUnderstanding("  ")).toBe(false);
    expect(searchNeedsUnderstanding("red summer dress")).toBe(true);
    expect(searchNeedsUnderstanding("jeans 38")).toBe(true);
    expect(searchNeedsUnderstanding("שמלה אדומה לקיץ")).toBe(true);
  });

  it("accepts the empty understanding", () => {
    expect(searchUnderstandingSchema.safeParse(EMPTY_SEARCH_UNDERSTANDING).success).toBe(true);
  });

  it("replaces the kinds the words name and keeps the rest", () => {
    const next = applyUnderstanding(
      { q: "red dress under 100", brandIds: [a], categoryIds: [b], sort: "newest" },
      {
        ...EMPTY_SEARCH_UNDERSTANDING,
        understood: true,
        categoryId: a,
        colourIds: [b],
        priceMaxMinor: 10000,
      },
    );
    expect(next).toEqual({
      q: undefined,
      brandIds: [a],
      categoryId: a,
      categoryIds: undefined,
      colourIds: [b],
      priceMaxMinor: 10000,
      sort: "newest",
    });
    expect(
      applyUnderstanding({}, { ...EMPTY_SEARCH_UNDERSTANDING, q: "air force 1", sort: "price_asc" }),
    ).toEqual({
      q: "air force 1",
      sort: "price_asc",
    });
  });
});
