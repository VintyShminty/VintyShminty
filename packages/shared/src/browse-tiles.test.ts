import { describe, expect, it } from "vitest";
import { browseRestFor, browseTilesFor } from "./browse-tiles.js";

describe("browse panel tiles", () => {
  it("puts every other category behind More, once, and only the side's own", () => {
    for (const gender of ["women", "men"] as const) {
      const shown = browseTilesFor(gender).map((t) => t.key);
      const rest = browseRestFor(gender).map((t) => t.key);
      expect(rest.some((key) => shown.includes(key))).toBe(false);
      expect(new Set(rest).size).toBe(rest.length);
      expect(rest).toContain("home");
      expect(rest).toContain("kids");
    }
    expect(browseRestFor("men").map((t) => t.key)).not.toContain("dresses");
    expect(browseRestFor("women").find((t) => t.key === "bags")?.slugs).toEqual(["women-bags"]);
  });
});
