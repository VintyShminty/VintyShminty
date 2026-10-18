import { describe, expect, it } from "vitest";
import { searchTerms, searchTokens, termQuery } from "./discovery.js";

describe("searchTerms", () => {
  it("keeps a joined word as one term", () => {
    expect(searchTerms("H&M")).toEqual([{ text: "hm", parts: ["h", "m"] }]);
    expect(searchTerms("Levi's")).toEqual([{ text: "levis", parts: ["levi", "s"] }]);
    expect(searchTerms("Levi’s")).toEqual([{ text: "levis", parts: ["levi", "s"] }]);
    expect(searchTerms("T-shirt")).toEqual([{ text: "tshirt", parts: ["t", "shirt"] }]);
    expect(searchTerms("women's")).toEqual([{ text: "womens", parts: ["women", "s"] }]);
    expect(searchTerms("ג'ינס")).toEqual([{ text: "גינס", parts: ["ג", "ינס"] }]);
    expect(searchTerms("ת״א")).toEqual([{ text: "תא", parts: ["ת", "א"] }]);
  });

  it("gives plain words no parts", () => {
    expect(searchTerms("Blue Dress")).toEqual([
      { text: "blue", parts: [] },
      { text: "dress", parts: [] },
    ]);
  });

  it("drops joiners at the edges", () => {
    expect(searchTerms("'hello'")).toEqual([{ text: "hello", parts: [] }]);
    expect(searchTerms("-- & --")).toEqual([]);
  });

  it("splits on anything else", () => {
    expect(searchTerms("100%")).toEqual([{ text: "100", parts: [] }]);
    expect(searchTerms("a & b | (c)")).toEqual([
      { text: "ab", parts: ["a", "b"] },
      { text: "c", parts: [] },
    ]);
    expect(searchTerms("h & m")).toEqual([{ text: "hm", parts: ["h", "m"] }]);
    expect(searchTerms("x:*")).toEqual([{ text: "x", parts: [] }]);
  });

  it("returns nothing for empty or symbol only text", () => {
    expect(searchTerms("\\")).toEqual([]);
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms(undefined)).toEqual([]);
  });

  it("keeps at most 8 terms", () => {
    expect(searchTerms("a b c d e f g h i")).toHaveLength(8);
  });

  it("keeps accented letters", () => {
    expect(searchTerms("café")).toEqual([{ text: "café", parts: [] }]);
  });
});

describe("searchTokens", () => {
  it("returns the plain text of each term", () => {
    expect(searchTokens("H&M Levi's dress")).toEqual(["hm", "levis", "dress"]);
    expect(searchTokens(undefined)).toEqual([]);
  });
});

describe("termQuery", () => {
  const q = (text: string) => termQuery(searchTerms(text)[0] as never);

  it("is exact for short terms", () => {
    expect(q("H&M")).toBe("hm | (h <-> m)");
    expect(q("xs")).toBe("xs");
    expect(q("m")).toBe("m");
  });

  it("is a prefix for longer terms", () => {
    expect(q("Levi's")).toBe("levis:* | (levi <-> s:*)");
    expect(q("dress")).toBe("dress:*");
  });
});
