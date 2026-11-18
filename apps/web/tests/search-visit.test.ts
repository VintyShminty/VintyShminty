import { createRecentSearchInputSchema } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { recentSearchBody } from "../lib/search-visit";

const BRAND = "11111111-1111-4111-8111-111111111111";
const CAT = "22222222-2222-4222-8222-222222222222";
const CAT2 = "33333333-3333-4333-8333-333333333333";
const SIZE = "44444444-4444-4444-8444-444444444444";

describe("recentSearchBody", () => {
  it("sends the words alone for a plain search, in the shape the server accepts", () => {
    const body = recentSearchBody("nike sneakers", "q=nike+sneakers");
    expect(body).toEqual({ queryText: "nike sneakers", filters: { sort: "relevance" } });
    expect(createRecentSearchInputSchema.safeParse(body).success).toBe(true);
  });

  it("carries the filters of the address, one category as the category Home learns from", () => {
    const query = `q=dress&brand=${BRAND}~Zara&size=${SIZE}&min=50&max=120&category=${CAT}~Dresses&asked=x`;
    const body = recentSearchBody("dress", query);
    expect(body.filters).toEqual({
      sort: "relevance",
      brandIds: [BRAND],
      sizeIds: [SIZE],
      priceMinMinor: 5000,
      priceMaxMinor: 12_000,
      categoryId: CAT,
    });
    expect(createRecentSearchInputSchema.safeParse(body).success).toBe(true);
  });

  it("sends several categories as a list", () => {
    const body = recentSearchBody("dress", `q=dress&category=${CAT}~Dresses&category=${CAT2}~Skirts`);
    expect(body.filters).toEqual({ sort: "relevance", categoryIds: [CAT, CAT2] });
    expect(createRecentSearchInputSchema.safeParse(body).success).toBe(true);
  });
});
