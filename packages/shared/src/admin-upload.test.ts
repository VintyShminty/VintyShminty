import { describe, expect, it } from "vitest";
import { leafOptions, searchLeaves, splitIntoGroups } from "./admin-upload.js";
import type { CategoryNode, ReferenceData } from "./reference-data.js";

describe("splitIntoGroups", () => {
  it("keeps one drop together as one item", () => {
    expect(splitIntoGroups(["a", "b", "c"], 20)).toEqual([["a", "b", "c"]]);
  });

  it("starts further items past the maximum, in order", () => {
    expect(splitIntoGroups([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("gives nothing for nothing and never loops on a bad size", () => {
    expect(splitIntoGroups([], 20)).toEqual([]);
    expect(splitIntoGroups([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("searchLeaves", () => {
  const node = (id: string, en: string, he: string, children: CategoryNode[] = []) =>
    ({ id, name: { en, he }, isLeaf: children.length === 0, children }) as unknown as CategoryNode;
  const reference = {
    categories: [
      node("w", "Women", "נשים", [node("wj", "Jeans", "ג'ינס"), node("wt", "T-shirts", "חולצות טי")]),
      node("m", "Men", "גברים", [node("mj", "Jeans", "ג'ינס")]),
    ],
  } as unknown as ReferenceData;
  const options = leafOptions(reference, "en");
  const ids = (query: string) => searchLeaves(options, query).map((o) => o.id);

  it("matches the start of a word, so men is not found inside women", () => {
    expect(ids("men")).toEqual(["mj"]);
    expect(ids("men jea")).toEqual(["mj"]);
    expect(ids("wom")).toEqual(["wj", "wt"]);
  });

  it("reads hyphens as spaces and finds Hebrew", () => {
    expect(ids("shirts")).toEqual(["wt"]);
    expect(ids("t-shirt")).toEqual(["wt"]);
    expect(ids("גברים")).toEqual(["mj"]);
  });
});
