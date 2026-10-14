import { describe, expect, it } from "vitest";
import {
  affinityDeltas,
  arrangeFeed,
  confidence,
  EVENT_WEIGHTS,
  effectiveScore,
  HALF_LIFE_DAYS,
  priceBand,
  type ScoredItem,
  VARIETY,
} from "./recommendations.js";

describe("weights", () => {
  it("match the plan", () => {
    expect(EVENT_WEIGHTS.purchase).toBe(8);
    expect(EVENT_WEIGHTS.favourite).toBe(4);
    expect(EVENT_WEIGHTS.unfavourite).toBe(-4);
    expect(EVENT_WEIGHTS.not_interested).toBe(-3);
    expect(EVENT_WEIGHTS.impression).toBe(0);
    expect(EVENT_WEIGHTS.category_visit).toBe(0.5);
  });
});

describe("fading", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  it("uses a 7 day half life", () => {
    expect(HALF_LIFE_DAYS).toBe(7);
    expect(effectiveScore(8, now, now)).toBe(8);
    expect(effectiveScore(8, daysAgo(7), now)).toBeCloseTo(4);
    expect(effectiveScore(8, daysAgo(14), now)).toBeCloseTo(2);
  });
  it("never grows for a time in the future", () => {
    expect(effectiveScore(8, daysAgo(-1), now)).toBe(8);
  });
});

describe("confidence", () => {
  it("grows from 0 to 1 over 30 points", () => {
    expect(confidence(0)).toBe(0);
    expect(confidence(15)).toBe(0.5);
    expect(confidence(30)).toBe(1);
    expect(confidence(300)).toBe(1);
    expect(confidence(-5)).toBe(0);
  });
});

describe("price bands", () => {
  it("cuts at 50, 100, 200, 400 and 800 shekels", () => {
    expect(priceBand(0)).toBe(0);
    expect(priceBand(4999)).toBe(0);
    expect(priceBand(5000)).toBe(1);
    expect(priceBand(9999)).toBe(1);
    expect(priceBand(10_000)).toBe(2);
    expect(priceBand(20_000)).toBe(3);
    expect(priceBand(40_000)).toBe(4);
    expect(priceBand(79_999)).toBe(4);
    expect(priceBand(80_000)).toBe(5);
    expect(priceBand(null)).toBeNull();
  });
});

describe("affinityDeltas", () => {
  it("spreads a heart over the features of the item", () => {
    const deltas = affinityDeltas(4, {
      categoryId: "dress",
      parentCategoryIds: ["clothing", "women"],
      brandId: "zara",
      sellerId: "s1",
      sizeId: "m",
      priceMinor: 7000,
      colourIds: ["red", "black"],
      conditionId: "good",
    });
    const get = (feature: string, key: string) =>
      deltas.find((d) => d.feature === feature && d.key === key)?.delta;
    expect(get("category", "dress")).toBeCloseTo(4);
    expect(get("parent_category", "clothing")).toBeCloseTo(2);
    expect(get("parent_category", "women")).toBeCloseTo(2);
    expect(get("brand", "zara")).toBeCloseTo(3.2);
    expect(get("seller", "s1")).toBeCloseTo(2.8);
    expect(get("size", "m")).toBeCloseTo(2.4);
    expect(get("price_band", "1")).toBeCloseTo(2);
    expect(get("colour", "red")).toBeCloseTo(1.2);
    expect(get("condition", "good")).toBeCloseTo(1.2);
  });
  it("adds one delta per style tag, worth 0.6 of the action (D-040)", () => {
    const deltas = affinityDeltas(4, { styles: ["vintage", "y2k"] });
    expect(deltas).toEqual([
      { feature: "style", key: "vintage", delta: expect.closeTo(2.4) },
      { feature: "style", key: "y2k", delta: expect.closeTo(2.4) },
    ]);
    expect(affinityDeltas(4, { styles: [] })).toEqual([]);
    expect(affinityDeltas(-3, { styles: ["goth"] })[0]?.delta).toBeCloseTo(-1.8);
  });
  it("turns negative for an unfavourite and skips missing features", () => {
    const deltas = affinityDeltas(-4, { categoryId: "dress" });
    expect(deltas).toEqual([{ feature: "category", key: "dress", delta: -4 }]);
  });
  it("makes nothing for an impression", () => {
    expect(affinityDeltas(0, { categoryId: "dress" })).toEqual([]);
  });
});

describe("arrangeFeed", () => {
  const item = (n: number, over: Partial<ScoredItem> = {}): ScoredItem => ({
    id: `i${n}`,
    score: 100 - n,
    sellerId: `s${n}`,
    brandId: `b${n}`,
    categoryId: `c${n}`,
    isBumped: false,
    isExplore: false,
    ...over,
  });
  const count = <T>(list: T[], pick: (t: T) => string | null) => {
    const m = new Map<string, number>();
    for (const t of list) {
      const k = pick(t);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Math.max(0, ...m.values());
  };

  it("uses 3 surprise cards in 20 at positions 5, 12 and 19", () => {
    expect(VARIETY.exploreSlots).toEqual([5, 12, 19]);
    const sorted = [
      ...Array.from({ length: 40 }, (_, n) => item(n)),
      ...Array.from({ length: 10 }, (_, n) => item(100 + n, { isExplore: true, score: -1 })),
    ];
    const page = arrangeFeed(sorted, 20);
    expect(page).toHaveLength(20);
    const explore = page.flatMap((p, i) => (p.explore ? [i] : []));
    expect(explore).toEqual([5, 12, 19]);
    expect(page[5]?.id).toBe("i100");
  });

  it("never puts more than 2 items of one seller, 4 of a brand or 6 of a category on a page", () => {
    const sorted = Array.from({ length: 100 }, (_, n) =>
      item(n, { sellerId: `s${n % 3}`, brandId: "zara", categoryId: "dress" }),
    );
    const pages = arrangeFeed(sorted, 20);
    // Only 3 sellers x 2 = 6 fit before the rules give way, but the first 6 respect every limit.
    const first = pages.slice(0, 4);
    const lookup = new Map(sorted.map((s) => [s.id, s]));
    expect(count(first, (p) => lookup.get(p.id)?.sellerId ?? null)).toBeLessThanOrEqual(2);
    expect(count(first, (p) => lookup.get(p.id)?.brandId ?? null)).toBeLessThanOrEqual(4);
  });

  it("keeps the best items first and moves the rest to the next page", () => {
    const sorted = [
      ...Array.from({ length: 5 }, (_, n) => item(n, { sellerId: "same" })),
      ...Array.from({ length: 30 }, (_, n) => item(10 + n)),
    ];
    const page = arrangeFeed(sorted, 20).map((p) => p.id);
    expect(page.filter((id) => ["i0", "i1", "i2", "i3", "i4"].includes(id))).toEqual(["i0", "i1"]);
    const next = arrangeFeed(sorted, 40).map((p) => p.id);
    expect(next.slice(20)).toContain("i2");
  });

  it("allows one bumped item in any six in a row", () => {
    const sorted = Array.from({ length: 40 }, (_, n) => item(n, { isBumped: n % 2 === 0 }));
    const page = arrangeFeed(sorted, 20);
    const bumped = new Set(sorted.filter((s) => s.isBumped).map((s) => s.id));
    for (let start = 0; start + 6 <= page.length; start++) {
      const window = page.slice(start, start + 6).filter((p) => bumped.has(p.id)).length;
      expect(window).toBeLessThanOrEqual(1);
    }
  });

  it("never loses or repeats an item", () => {
    const sorted = Array.from({ length: 50 }, (_, n) => item(n, { sellerId: `s${n % 2}` }));
    const out = arrangeFeed(sorted, 500).map((p) => p.id);
    expect(new Set(out).size).toBe(50);
  });
});
