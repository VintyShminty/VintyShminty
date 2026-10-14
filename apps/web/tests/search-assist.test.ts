import { EMPTY_SEARCH_UNDERSTANDING } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import {
  exactWordsHref,
  readAsked,
  shouldUnderstand,
  understoodHref,
  withoutAsked,
} from "../lib/search-assist";

const BRAND = "11111111-1111-4111-8111-111111111111";
const CAT = "22222222-2222-4222-8222-222222222222";
const COLOUR = "33333333-3333-4333-8333-333333333333";
const names = { brands: { [BRAND]: "Zara" }, categories: { [CAT]: "Dresses" }, brandFallback: "Brand" };
const understood = { ...EMPTY_SEARCH_UNDERSTANDING, understood: true };

describe("shouldUnderstand", () => {
  it("needs the helper on and a sentence or a number", () => {
    expect(shouldUnderstand("red summer dress", true)).toBe(true);
    expect(shouldUnderstand("red summer dress", false)).toBe(false);
    expect(shouldUnderstand("zara", true)).toBe(false);
    expect(shouldUnderstand("dress 100", true)).toBe(true);
  });
});

describe("understoodHref", () => {
  it("writes filters into the address with the original words", () => {
    const href = understoodHref(
      "en",
      "red zara dress under 100",
      {
        ...understood,
        categoryId: CAT,
        brandIds: [BRAND],
        brands: [{ id: BRAND, name: "Zara" }],
        colourIds: [COLOUR],
        priceMaxMinor: 10000,
      },
      names,
    );
    const url = new URL(`http://x${href}`);
    expect(url.pathname).toBe("/en/search");
    expect(url.searchParams.get("brand")).toBe(`${BRAND}~Zara`);
    expect(url.searchParams.get("category")).toBe(`${CAT}~Dresses`);
    expect(url.searchParams.get("colour")).toBe(COLOUR);
    expect(url.searchParams.get("max")).toBe("100");
    expect(url.searchParams.get("asked")).toBe("red zara dress under 100");
    expect(url.searchParams.has("q")).toBe(false);
  });
  it("keeps leftover words as q and falls back for an unknown brand", () => {
    const href = understoodHref(
      "he",
      "air force 1 white",
      { ...understood, q: "air force 1", brandIds: [CAT] },
      names,
    );
    const url = new URL(`http://x${href}`);
    expect(url.searchParams.get("q")).toBe("air force 1");
    expect(url.searchParams.get("brand")).toBe(`${CAT}~Brand`);
  });
  it("is null when nothing was understood or no filter the website shows came out", () => {
    expect(understoodHref("en", "x y z", EMPTY_SEARCH_UNDERSTANDING, names)).toBeNull();
    expect(understoodHref("en", "x y z", { ...understood, q: "hello" }, names)).toBeNull();
  });
});

describe("the marker", () => {
  it("is read, dropped and undone", () => {
    expect(readAsked(["a b", "c"])).toBe("a b");
    expect(readAsked(undefined)).toBe("");
    expect(withoutAsked(new URLSearchParams("asked=a&min=5")).toString()).toBe("min=5");
    expect(exactWordsHref("en", "red dress & more")).toBe("/en/search?q=red+dress+%26+more");
  });
});
