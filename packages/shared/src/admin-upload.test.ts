import { describe, expect, it } from "vitest";
import { splitIntoGroups } from "./admin-upload.js";

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
