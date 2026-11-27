import { type AffinityFeature, OPENED_KEEP, OTHER_GROUP_MINUS, resolveGroups } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import {
  bestTerm,
  buildTaste,
  type Candidate,
  type RecentSearch,
  scoreCandidate,
  searchedFor,
  type Taste,
} from "./feed.js";

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

  it("fades a line to half after 30 days", () => {
    const taste = buildTaste(
      [line("category", "dress", 10, daysAgo(30)), line("category", "coat", 10, now)],
      new Set(),
      now,
    );
    expect(taste.scores.category.get("coat")).toBe(1);
    expect(taste.scores.category.get("dress")).toBeCloseTo(0.5);
  });

  it("fades a category outside the person's groups to half after 7 days", () => {
    const t = buildTaste(
      [line("category", "dresses", 8, daysAgo(7)), line("category", "shirts", 8, daysAgo(7))],
      new Set(),
      now,
      new Set(["dresses"]),
    );
    // Shirts lost little in a week and is the best line. Dresses is at half of its 8.
    expect(t.scores.category.get("shirts")).toBe(1);
    expect(t.scores.category.get("dresses")).toBeCloseTo(4 / (8 * 0.5 ** (7 / 30)));
  });

  it("grows the confidence with recent activity, up to 1 at 30 points", () => {
    expect(buildTaste([line("category", "a", 15)], new Set(), now).confidence).toBeCloseTo(0.5);
    expect(
      buildTaste([line("category", "a", 20), line("category", "b", 20)], new Set(), now).confidence,
    ).toBe(1);
    // The same points 30 days ago count half.
    expect(buildTaste([line("category", "a", 30, daysAgo(30))], new Set(), now).confidence).toBeCloseTo(0.5);
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
  priceDropAgeDays: null,
  lowestRecentPriceMinor: null,
  bumpedAt: daysAgo(10),
  bumpedUntil: null,
  publishedAt: daysAgo(10),
  viewCount: 100,
  pop: 0,
  colourIds: [],
  styles: [],
  explore: false,
  ...over,
});

const taste = (over: Partial<Taste> = {}): Taste => ({
  ...buildTaste([], new Set(), now),
  groups: null,
  follows: new Set(),
  pickedBrands: new Set(),
  chosenSizes: new Set(),
  seen: new Map(),
  searches: [],
  ...over,
});

const ctx = { now, seed: "t", maxPop: 1, parentsOf: () => [] as string[], groupRoots: new Set<string>() };

describe("shopping groups", () => {
  const roots = new Map([
    ["women", "W"],
    ["men", "M"],
    ["kids", "K"],
  ]);
  // Women > Sports > Cycling, Women > Dresses, Men > Shirts, and Home with no group.
  const parents: Record<string, string[]> = {
    cycling: ["sports", "W"],
    dresses: ["W"],
    shirts: ["M"],
    lamps: ["home"],
  };
  const groupCtx = {
    ...ctx,
    parentsOf: (id: string) => parents[id] ?? [],
    groupRoots: new Set(["W", "M", "K"]),
  };
  const man = (lines: ReturnType<typeof line>[] = []) =>
    taste({ ...buildTaste(lines, new Set(["W", "M", "K"]), now), groups: new Set(["M"]) });
  const score = (categoryId: string, t: Taste) =>
    scoreCandidate(candidate({ categoryId }), t, groupCtx).score;

  it("keeps the answer, and otherwise works the group out once it is clear", () => {
    expect(resolveGroups(["men"], roots, new Map([["W", 50]]))).toEqual(new Set(["M"]));
    expect(resolveGroups([], roots, new Map([["W", 2]]))).toBeNull();
    expect(
      resolveGroups(
        [],
        roots,
        new Map([
          ["W", 8],
          ["M", 2],
        ]),
      ),
    ).toEqual(new Set(["W"]));
    expect(
      resolveGroups(
        [],
        roots,
        new Map([
          ["W", 5],
          ["M", 5],
        ]),
      ),
    ).toBeNull();
  });

  it("moves another group lower, never items with no group", () => {
    const t = man();
    expect(score("shirts", t) - score("dresses", t)).toBeCloseTo(OTHER_GROUP_MINUS);
    expect(score("lamps", t)).toBeCloseTo(score("shirts", t));
  });

  it("lowers another group by more than a scrolled past card of the person's own group loses", () => {
    const t = man();
    const seenOften = taste({ ...t, seen: new Map([["own", { shown: 50, opened: 0 }]]) });
    const own = scoreCandidate(candidate({ id: "own", categoryId: "shirts" }), seenOften, groupCtx).score;
    expect(own).toBeGreaterThan(score("dresses", seenOften));
  });

  it("lowers nothing when the groups are unknown", () => {
    const t = taste();
    expect(score("dresses", t)).toBeCloseTo(score("shirts", t));
  });

  it("lifts the corner the person opened and not the rest of that group", () => {
    const t = man([line("category", "cycling", 4), line("parent_category", "sports", 2)]);
    const cycling = score("cycling", t);
    expect(cycling).toBeGreaterThan(score("dresses", t) + OTHER_GROUP_MINUS - 0.01);
  });
});

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

  it("lifts an item whose style the person likes, using the best matching style (D-042)", () => {
    const learned = taste({
      ...buildTaste(
        [line("category", "shoes", 40), line("style", "vintage", 40), line("style", "y2k", 10)],
        new Set(),
        now,
      ),
    });
    const none = scoreCandidate(candidate(), learned, ctx).score;
    const one = scoreCandidate(candidate({ styles: ["vintage"] }), learned, ctx).score;
    const several = scoreCandidate(candidate({ styles: ["y2k", "vintage", "goth"] }), learned, ctx).score;
    const weak = scoreCandidate(candidate({ styles: ["y2k"] }), learned, ctx).score;
    expect(one - none).toBeCloseTo(0.6 * 1, 5);
    // Several styles count as the best match, not the sum.
    expect(several).toBeCloseTo(one, 5);
    expect(weak - none).toBeCloseTo(0.6 * 0.25, 5);
    // No new reason line: styles are never explained to the person.
    expect(scoreCandidate(candidate({ styles: ["vintage"] }), learned, ctx).terms.map((t) => t.kind)).toEqual(
      scoreCandidate(candidate(), learned, ctx).terms.map((t) => t.kind),
    );
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

  it("moves a card down a little more each time it is shown and not opened", () => {
    const shownTimes = (shown: number, opened = 0, over: Partial<Taste> = {}) =>
      scoreCandidate(candidate(), taste({ ...over, seen: new Map([["i1", { shown, opened }]]) }), ctx).score;
    const clean = scoreCandidate(candidate(), taste(), ctx).score;
    // With no taste to scale: a twentieth per view, up to a half after ten views.
    expect(clean - shownTimes(1)).toBeCloseTo(0.05);
    expect(clean - shownTimes(3)).toBeCloseTo(0.15);
    expect(clean - shownTimes(10)).toBeCloseTo(0.5);
    expect(clean - shownTimes(25)).toBeCloseTo(0.5);
    // An opened card follows the opened rule instead, however often it was shown.
    expect(shownTimes(5, 1)).toBeCloseTo(clean);

    // A strong taste match (follows the seller 1, chosen size 0.6) also keeps 95 percent of its taste per view.
    const likes = { follows: new Set(["s1"]), chosenSizes: new Set(["m"]) };
    const liked = scoreCandidate(candidate(), taste(likes), ctx).score;
    expect(liked - shownTimes(1, 0, likes)).toBeCloseTo(1.6 * 0.05 + 0.05);
    expect(liked - shownTimes(4, 0, likes)).toBeCloseTo(1.6 * (1 - 0.95 ** 4) + 0.2);
    // Both parts stop: at 40 percent of the taste and at a half outright.
    expect(liked - shownTimes(100, 0, likes)).toBeCloseTo(1.6 * 0.6 + 0.5);
  });

  it("counts the taste of an item opened this week for half, and leaves the general score alone", () => {
    const likes = { follows: new Set(["s1"]), chosenSizes: new Set(["m"]) };
    const fresh = candidate({ bumpedAt: hoursAgo(0) });
    const clean = scoreCandidate(fresh, taste(likes), ctx).score;
    const opened = scoreCandidate(
      fresh,
      taste({ ...likes, seen: new Map([["i1", { shown: 2, opened: 1 }]]) }),
      ctx,
    ).score;
    // Follows the seller (1) plus a chosen size (0.6): half of 1.6 goes, the freshness stays.
    expect(OPENED_KEEP).toBe(0.5);
    expect(clean - opened).toBeCloseTo(0.8);
  });

  it("offers a listing of the last 7 days for the new listing spots, unless it was lowered for this person", () => {
    const young = candidate({ publishedAt: hoursAgo(10) });
    const seenAs = (shown: number, opened: number) => taste({ seen: new Map([["i1", { shown, opened }]]) });
    expect(scoreCandidate(young, null, ctx).fresh).toBe(true);
    expect(scoreCandidate(young, taste(), ctx).fresh).toBe(true);
    expect(scoreCandidate(candidate({ publishedAt: hoursAgo(6 * 24) }), taste(), ctx).fresh).toBe(true);
    expect(scoreCandidate(candidate({ publishedAt: hoursAgo(7 * 24 + 1) }), taste(), ctx).fresh).toBe(false);
    expect(scoreCandidate(candidate({ publishedAt: null }), taste(), ctx).fresh).toBe(false);
    // Already opened, or scrolled past three times: the spot goes to something they have not looked at.
    expect(scoreCandidate(young, seenAs(1, 1), ctx).fresh).toBe(false);
    expect(scoreCandidate(young, seenAs(3, 0), ctx).fresh).toBe(false);
    expect(scoreCandidate(young, seenAs(2, 0), ctx).fresh).toBe(true);
    // The shopping group alone is not a match: with nothing learned, a man's new listings lead through the general score.
    const man = taste({ groups: new Set(["M"]) });
    const under = (top: string) => ({ ...ctx, parentsOf: () => [top], groupRoots: new Set(["W", "M"]) });
    expect(scoreCandidate(young, man, under("W")).fresh).toBe(false);
    expect(scoreCandidate(young, man, under("M")).fresh).toBe(false);
  });

  it("keeps the new listing spots for the kind of thing the person looks at", () => {
    const young = candidate({ publishedAt: hoursAgo(10) });
    // Women > Dresses > Midi and Maxi, Women > Skirts > Mini.
    const parents: Record<string, string[]> = {
      midi: ["dresses", "W"],
      maxi: ["dresses", "W"],
      skirt: ["skirts", "W"],
    };
    const treeCtx = { ...ctx, parentsOf: (id: string) => parents[id] ?? [], groupRoots: new Set(["W", "M"]) };
    const lines = [
      line("category", "midi", 30),
      line("parent_category", "dresses", 15),
      line("parent_category", "W", 15),
      line("brand", "zara", 20),
      line("seller", "s9", 10),
    ];
    const her = taste({ ...buildTaste(lines, new Set(["W", "M"]), now), groups: new Set(["W"]) });
    const fresh = (over: Partial<Candidate>, t: Taste = her) =>
      scoreCandidate(candidate({ ...young, brandId: "mango", ...over }), t, treeCtx).fresh;
    // Her category, the one next to it under the same parent, her brand, a seller she likes.
    expect(fresh({ categoryId: "midi" })).toBe(true);
    expect(fresh({ categoryId: "maxi" })).toBe(true);
    expect(fresh({ categoryId: "skirt", brandId: "zara" })).toBe(true);
    expect(fresh({ categoryId: "skirt", sellerId: "s9" })).toBe(true);
    // Only the same shopping group, or only her size: not what she was looking for.
    expect(fresh({ categoryId: "skirt" })).toBe(false);
    expect(fresh({ categoryId: "skirt" }, { ...her, chosenSizes: new Set(["m"]) })).toBe(false);
    // A seller she follows and a brand she picked count from the first day.
    expect(fresh({ categoryId: "skirt" }, { ...her, follows: new Set(["s1"]) })).toBe(true);
    expect(fresh({ categoryId: "skirt" }, { ...her, pickedBrands: new Set(["mango"]) })).toBe(true);
  });

  it("offers what the person searched for lately for the search spots", () => {
    const nikeSneakers: RecentSearch = {
      categoryId: "shoes",
      categoryIds: new Set(["shoes", "sneakers"]),
      brandId: "nike",
    };
    const anyDress: RecentSearch = { categoryId: "dress", categoryIds: new Set(["dress"]), brandId: null };
    const anyAdidas: RecentSearch = { categoryId: null, categoryIds: null, brandId: "adidas" };
    const searches = [nikeSneakers, anyDress, anyAdidas];
    // The brand and the category both have to fit when the search had both.
    expect(searchedFor({ categoryId: "sneakers", brandId: "nike" }, searches)).toBe(nikeSneakers);
    expect(searchedFor({ categoryId: "sneakers", brandId: "puma" }, searches)).toBeNull();
    expect(searchedFor({ categoryId: "coat", brandId: "nike" }, searches)).toBeNull();
    expect(searchedFor({ categoryId: "dress", brandId: "zara" }, searches)).toBe(anyDress);
    expect(searchedFor({ categoryId: "coat", brandId: "adidas" }, searches)).toBe(anyAdidas);
    expect(searchedFor({ categoryId: null, brandId: null }, searches)).toBeNull();

    const searched = (over: Partial<Taste> = {}) =>
      scoreCandidate(candidate(), taste({ searches: [anyDress], ...over }), ctx).searched;
    expect(searched()).toBe(anyDress);
    expect(scoreCandidate(candidate(), taste(), ctx).searched).toBeNull();
    expect(scoreCandidate(candidate(), null, ctx).searched).toBeNull();
    // Already opened, or scrolled past three times: the spot goes to something else they searched for.
    expect(searched({ seen: new Map([["i1", { shown: 1, opened: 1 }]]) })).toBeNull();
    expect(searched({ seen: new Map([["i1", { shown: 3, opened: 0 }]]) })).toBeNull();
    expect(searched({ seen: new Map([["i1", { shown: 2, opened: 0 }]]) })).toBe(anyDress);
    // A search does not change the score itself.
    expect(scoreCandidate(candidate(), taste({ searches: [anyDress] }), ctx).score).toBeCloseTo(
      scoreCandidate(candidate(), taste(), ctx).score,
    );
  });

  it("adds a small boost for price drops, a running bump and a first chance", () => {
    const plain = scoreCandidate(candidate(), null, ctx).score;
    const dropped = scoreCandidate(
      candidate({ previousPriceMinor: 9000, lowestRecentPriceMinor: 9000, priceDropAgeDays: 1 }),
      null,
      ctx,
    ).score;
    const bumped = scoreCandidate(candidate({ bumpedUntil: hoursAgo(-5) }), null, ctx).score;
    const first = scoreCandidate(candidate({ publishedAt: hoursAgo(10), viewCount: 3 }), null, ctx).score;
    expect(dropped - plain).toBeCloseTo(0.2);
    expect(bumped - plain).toBeCloseTo(0.3);
    expect(first - plain).toBeCloseTo(0.2);
  });

  it("lifts only a real and recent price drop", () => {
    // The item costs 70 now. `was` is the price before, `lowest` the lowest price of the last 30 days.
    const lift = (was: number, lowest: number | null, days: number | null) =>
      scoreCandidate(
        candidate({ previousPriceMinor: was, lowestRecentPriceMinor: lowest, priceDropAgeDays: days }),
        null,
        ctx,
      ).score - scoreCandidate(candidate(), null, ctx).score;
    expect(lift(9000, 9000, 6)).toBeCloseTo(0.2);
    // One shekel off.
    expect(lift(7100, 7100, 0)).toBeCloseTo(0);
    // A drop from more than a week ago.
    expect(lift(9000, 9000, 8)).toBeCloseTo(0);
    // Raised to 90 and lowered back to 70: it was already 70 this month.
    expect(lift(9000, 7000, 0)).toBeCloseTo(0);
    // The Price drop badge without any price history (old data).
    expect(lift(9000, null, null)).toBeCloseTo(0);
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
