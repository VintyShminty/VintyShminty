import { describe, expect, it } from "vitest";
import { type BrandRow, planBrandCleanup, properBrandName } from "./brands-cleanup.js";
import { brandAliases, brandHebrew, brandNames } from "./reference/index.js";

const row = (over: Partial<BrandRow> & Pick<BrandRow, "id" | "name">): BrandRow => ({
  slug: over.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  nameHe: null,
  aliases: [],
  popularity: 0,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  ...over,
});

describe("brand seed", () => {
  it("has a Hebrew name for every brand and no stray entries", () => {
    expect(brandNames.filter((name) => !brandHebrew[name])).toEqual([]);
    expect(Object.keys(brandHebrew).filter((name) => !brandNames.includes(name))).toEqual([]);
    expect(Object.keys(brandAliases).filter((name) => !brandNames.includes(name))).toEqual([]);
  });

  it("writes Michael Kors in Hebrew the way Israelis do", () => {
    expect(brandHebrew["Michael Kors"]).toBe("מייקל קורס");
  });
});

describe("brand cleanup plan", () => {
  it("writes names properly and keeps the starter list's spelling", () => {
    expect(properBrandName({ slug: "michael-kors", name: "MICHAEL KORS" })).toBe("Michael Kors");
    expect(properBrandName({ slug: "h-and-m", name: "h&m" })).toBe("H&M");
    expect(properBrandName({ slug: "cos", name: "cos" })).toBe("COS");
    expect(properBrandName({ slug: "ikea", name: "Ikea" })).toBe("IKEA");
    expect(properBrandName({ slug: "g-star-raw", name: "G-STAR RAW" })).toBe("G-Star RAW");
    expect(properBrandName({ slug: "bla-vintage", name: "bla VINTAGE" })).toBe("Bla Vintage");
    expect(properBrandName({ slug: "mcqueen", name: "McQueen" })).toBe("McQueen");
  });

  it("merges brands that differ only in capitals or spacing into the starter row", () => {
    const plan = planBrandCleanup([
      row({ id: "a", name: "MICHAEL KORS", slug: "michael-kors-2", popularity: 500 }),
      row({ id: "b", name: "Michael Kors", slug: "michael-kors", popularity: 10, nameHe: "מייקל קורס" }),
      row({ id: "c", name: "michael  kors", slug: "michael-kors-3", aliases: ["MK"] }),
      row({ id: "d", name: "Zara", slug: "zara" }),
    ]);
    expect(plan.keep.map((k) => k.id).sort()).toEqual(["b", "d"]);
    expect(plan.merge.map((m) => m.id).sort()).toEqual(["a", "c"]);
    const kors = plan.keep.find((k) => k.id === "b");
    expect(kors).toMatchObject({ name: "Michael Kors", nameHe: "מייקל קורס", aliases: ["MK"] });
  });

  it("keeps a brand a seller added as the survivor when the starter list does not have it", () => {
    const plan = planBrandCleanup([
      row({ id: "a", name: "BLA VINTAGE", slug: "bla-vintage", popularity: 1 }),
      row({ id: "b", name: "bla vintage", slug: "bla-vintage-2", popularity: 5 }),
    ]);
    expect(plan.keep).toMatchObject([{ id: "b", name: "Bla Vintage" }]);
    expect(plan.merge).toMatchObject([{ id: "a", into: "b" }]);
  });

  it("changes nothing for a list that is already tidy", () => {
    const plan = planBrandCleanup([
      row({ id: "a", name: "Zara", slug: "zara" }),
      row({ id: "b", name: "Nike", slug: "nike" }),
    ]);
    expect(plan.merge).toEqual([]);
    expect(plan.keep.every((k) => k.name === k.oldName)).toBe(true);
  });
});
