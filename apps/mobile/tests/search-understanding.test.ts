import { EMPTY_SEARCH_UNDERSTANDING, type SearchUnderstanding } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { EMPTY_STATE, type SearchState } from "../lib/search-store";
import { applyUnderstandingToState } from "../lib/search-understanding";

const names = {
  categoryName: (id: string) => (id === "dresses" ? "Dresses" : undefined),
};
const read = (patch: Partial<SearchUnderstanding>): SearchUnderstanding => ({
  ...EMPTY_SEARCH_UNDERSTANDING,
  understood: true,
  ...patch,
});
const before: SearchState = { ...EMPTY_STATE, q: "red zara dress under 100" };

describe("applyUnderstandingToState", () => {
  it("turns the words into filters and keeps only the left over words in q", () => {
    const { next } = applyUnderstandingToState(
      before,
      "red zara dress under 100",
      read({
        categoryId: "dresses",
        brandIds: ["zara"],
        brands: [{ id: "zara", name: "Zara" }],
        colourIds: ["red"],
        priceMaxMinor: 10000,
        q: "",
      }),
      names,
    );
    expect(next.q).toBe("");
    expect(next.filters).toMatchObject({
      categoryId: "dresses",
      brandIds: ["zara"],
      colourIds: ["red"],
      priceMaxMinor: 10000,
    });
    expect(next.brandNames).toEqual({ zara: "Zara" });
    expect(next.categoryName).toBe("Dresses");
  });

  it("keeps filters already chosen and what the words do not name", () => {
    const withSize: SearchState = { ...before, filters: { sort: "relevance", sizeIds: ["m"] } };
    const { next } = applyUnderstandingToState(
      withSize,
      "x y z",
      read({ colourIds: ["red"], q: "air force" }),
      names,
    );
    expect(next.filters.sizeIds).toEqual(["m"]);
    expect(next.q).toBe("air force");
  });

  it("gives back the exact words and the filters from before as the way back", () => {
    const withSize: SearchState = {
      ...before,
      filters: { sort: "relevance", sizeIds: ["m"] },
      categoryName: "Shoes",
    };
    const { undo } = applyUnderstandingToState(
      withSize,
      "my words here",
      read({ categoryId: "dresses" }),
      names,
    );
    expect(undo.q).toBe("my words here");
    expect(undo.filters).toEqual(withSize.filters);
    expect(undo.categoryName).toBe("Shoes");
  });

  it("leaves a brand without a known name out of the names", () => {
    const { next } = applyUnderstandingToState(before, "a b c", read({ brandIds: ["unknown"] }), names);
    expect(next.filters.brandIds).toEqual(["unknown"]);
    expect(next.brandNames).toEqual({});
  });
});
