import type { AffinityFeature } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { bestTerm, buildTaste, type Candidate, scoreCandidate, type Taste } from "./feed.js";

const now = new Date("2026-10-13T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const line = (feature: AffinityFeature, key: string, score: number, at = now) => ({
  feature,
  key,
  score,
  scoredAt: at,
});

describe("buildTaste", () => {
  it("is empty for a new person", () => {
    const taste = buildTaste([], new Set(), now);
    expect(taste.confidence).toBe(0);
    expect(taste.top.categories).toEqual([]);
  });

  it("divides each score by the best score of its feature", () => {
    const taste = buildTaste([line("brand", "zara", 8), line("brand", "mango", 2)], new Set(), now);
    expect(taste.scores.brand.get("zara")).toBe(1);
    expect(taste.scores.brand.get("mango")).toBeCloseTo(0.25);
    expect(taste.top.brands).toEqual(["zara", "mango"]);
  });

  it("fades a line to half after 7 days", () => {
    const taste = buildTaste(
      [line("category", "dress", 10, daysAgo(7)), line("category", "coat", 10, now)],
      new Set(),
      now,
    );
    expect(taste.scores.category.get("coat")).toBe(1);
    expect(taste.scores.category.get("dress")).toBeCloseTo(0.5);
  });

  it("grows the confidence with recent activity, up to 1 at 30 points", () => {
    expect(buildTaste([line("category", "a", 15)], new Set(), now).confidence).toBeCloseTo(0.5);
    expect(
      buildTaste([line("category", "a", 20), line("category", "b", 20)], new Set(), now).confidence,
    ).toBe(1);
    // The same points a week ago count half.
    expect(buildTaste([line("category", "a", 30, daysAgo(7))], new Set(), now).confidence).toBeCloseTo(0.5);
  });

  it("lets the onboarding picks give a small start", () => {
    const taste = buildTaste([line("parent_category", "women", 3)], new Set(["women"]), now);
    expect(taste.confidence).toBeCloseTo(0.1);
  });
});

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: "i1",
  sellerId: "s1",
  categoryId: "dress",
  brandId: "zara",
  brandName: "Zara",
  sizeId: "m",
  conditionId: null,
  priceBand: 1,
  priceMinor: 7000,
  previousPriceMinor: null,
  bumpedAt: daysAgo(10),
  bumpedUntil: null,
  publishedAt: daysAgo(10),
  viewCount: 100,
  pop: 0,
  colourIds: [],
  explore: false,
  ...over,
});

const taste = (over: Partial<Taste> = {}): Taste => ({
  ...buildTaste([], new Set(), now),
  follows: new Set(),
  pickedBrands: new Set(),
  chosenSizes: new Set(),
  seen: new Map(),
  ...over,
});

const ctx = { now, seed: "t", maxPop: 1, parentsOf: () => [] as string[] };

describe("scoreCandidate", () => {
  it("scores a visitor with the general score only", () => {
    const fresh = scoreCandidate(candidate({ bumpedAt: hoursAgo(1), publishedAt: hoursAgo(1) }), null, ctx);
    const old = scoreCandidate(candidate(), null, ctx);
    expect(fresh.score).toBeGreaterThan(old.score);
    expect(fresh.terms.every((t) => !["like_brand", "like_category", "like_seller"].includes(t.kind))).toBe(
      true,
    );
  });

  it("lets taste lift an old item over a new one once the person is confident", () => {
    const learned = taste({
      ...buildTaste([line("category", "dress", 40), line("brand", "zara", 30)], new Set(), now),
    });
    const liked = scoreCandidate(candidate(), learned, ctx);
    const other = scoreCandidate(
      candidate({
        id: "i2",
        categoryId: "coat",
        brandId: "mango",
        bumpedAt: hoursAgo(2),
        publishedAt: hoursAgo(2),
      }),
      learned,
      ctx,
    );
    expect(liked.score).toBeGreaterThan(other.score);
    expect(bestTerm(liked.terms)?.kind).toBe("like_category");
  });

  it("does not trust a new person's taste: confidence scales what was learned", () => {
    const small = taste({ ...buildTaste([line("category", "dress", 3)], new Set(), now) });
    const withTaste = scoreCandidate(candidate(), small, ctx).score;
    const without = scoreCandidate(candidate(), null, ctx).score;
    expect(withTaste - without).toBeCloseTo(0.1 * 1, 1);
  });

  it("counts a followed seller, a picked brand and a chosen size from the first day", () => {
    const base = scoreCandidate(candidate(), taste(), ctx);
    const followed = scoreCandidate(candidate(), taste({ follows: new Set(["s1"]) }), ctx);
    const picked = scoreCandidate(candidate(), taste({ pickedBrands: new Set(["zara"]) }), ctx);
    const sized = scoreCandidate(candidate(), taste({ chosenSizes: new Set(["m"]) }), ctx);
    expect(followed.score - base.score).toBeCloseTo(1);
    expect(picked.score - base.score).toBeCloseTo(0.6);
    expect(sized.score - base.score).toBeCloseTo(0.6);
    expect(bestTerm(followed.terms)?.kind).toBe("follows_seller");
  });

  it("drops an item shown 3 times in 7 days and never opened", () => {
    const clean = scoreCandidate(candidate(), taste(), ctx).score;
    const ignored = scoreCandidate(
      candidate(),
      taste({ seen: new Map([["i1", { shown: 3, opened: 0 }]]) }),
      ctx,
    ).score;
    const opened = scoreCandidate(
      candidate(),
      taste({ seen: new Map([["i1", { shown: 5, opened: 1 }]]) }),
      ctx,
    ).score;
    expect(clean - ignored).toBeCloseTo(0.5);
    expect(opened).toBeCloseTo(clean);
  });

  it("adds a small boost for price drops, a running bump and a first chance", () => {
    const plain = scoreCandidate(candidate(), null, ctx).score;
    const dropped = scoreCandidate(candidate({ previousPriceMinor: 9000 }), null, ctx).score;
    const bumped = scoreCandidate(candidate({ bumpedUntil: hoursAgo(-5) }), null, ctx).score;
    const first = scoreCandidate(candidate({ publishedAt: hoursAgo(10), viewCount: 3 }), null, ctx).score;
    expect(dropped - plain).toBeCloseTo(0.2);
    expect(bumped - plain).toBeCloseTo(0.3);
    expect(first - plain).toBeCloseTo(0.2);
  });

  it("keeps the shuffle the same for the same seed and small", () => {
    const a = scoreCandidate(candidate(), null, ctx).score;
    expect(scoreCandidate(candidate(), null, ctx).score).toBe(a);
    const b = scoreCandidate(candidate(), null, { ...ctx, seed: "other" }).score;
    expect(Math.abs(a - b)).toBeLessThan(0.1);
  });
});

describe("bestTerm", () => {
  it("names the biggest term, and nothing when no term is big enough", () => {
    expect(
      bestTerm([
        { value: 0.3, kind: "popular", ref: null },
        { value: 0.5, kind: "like_brand", ref: null },
      ])?.kind,
    ).toBe("like_brand");
    expect(bestTerm([{ value: 0.05, kind: "popular", ref: null }])).toBeNull();
    expect(bestTerm([])).toBeNull();
  });
});
