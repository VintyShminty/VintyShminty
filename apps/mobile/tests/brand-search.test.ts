import { describe, expect, it } from "vitest";
import { brandSearchState } from "../lib/brand-search";

describe("brand search", () => {
  it("filters by the brand when it is on our list", () => {
    const state = brandSearchState({ id: "b1", name: "Zara" });
    expect(state.filters?.brandIds).toEqual(["b1"]);
    expect(state.brandNames).toEqual({ b1: "Zara" });
    expect(state.q).toBeUndefined();
  });

  it("searches the name as words when the brand was only typed", () => {
    expect(brandSearchState({ id: null, name: "Bla Vintage" })).toEqual({ q: "Bla Vintage" });
  });
});
