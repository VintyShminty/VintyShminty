import { describe, expect, it } from "vitest";
import { MAX_TIP_LINES, nextCheckKeys, shouldAskText, tipLines } from "../lib/sell-assist";

describe("shouldAskText", () => {
  it("needs enough letters and a change", () => {
    expect(shouldAskText("a", "", "")).toBe(false);
    expect(shouldAskText("Nike", "", "")).toBe(true);
    expect(shouldAskText("Nike", "", "Nike")).toBe(false);
    expect(shouldAskText("Nike", "worn twice", "Nike")).toBe(true);
  });
});

describe("nextCheckKeys", () => {
  it("skips checked photos and takes four at most, oldest first", () => {
    const keys = ["a", "b", "c", "d", "e", "f"];
    expect(nextCheckKeys(keys, new Set(["a"]))).toEqual(["b", "c", "d", "e"]);
  });
});

describe("tipLines", () => {
  it("uses the photo's current place, the most important kind, skips dismissed, shows two", () => {
    const order = ["a", null, "b", "c"];
    const tips = { a: ["dark", "contact"], b: ["dark"], c: ["cut_off"] } as const;
    const lines = tipLines(order, tips as never, []);
    expect(lines).toEqual([
      { key: "a", n: 1, kind: "contact" },
      { key: "b", n: 3, kind: "dark" },
    ]);
    expect(lines.length).toBeLessThanOrEqual(MAX_TIP_LINES);
    expect(tipLines(order, tips as never, ["a"])[0]).toEqual({ key: "b", n: 3, kind: "dark" });
  });
  it("forgets a tip when its photo is gone", () => {
    expect(tipLines(["b"], { a: ["dark"] }, [])).toEqual([]);
  });
});
