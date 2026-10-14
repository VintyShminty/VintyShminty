import { LISTING_STYLES, LISTING_STYLES_MAX } from "@vinty/shared";
import { describe, expect, it, vi } from "vitest";
import { AiRefusedError } from "./ai-cost.js";
import {
  fakeListingCheckReader,
  LISTING_CHECK_INSTRUCTIONS,
  type ListingChecker,
  rawListingCheckSchema,
  resolveListingStyles,
  STYLE_CATCH_UP_LIMIT,
  tagUntaggedListings,
} from "./listing-check.js";

describe("resolving the style tags of the listing check (D-040)", () => {
  it("is empty when the model gives none, or nothing usable", () => {
    expect(resolveListingStyles({ flags: [] })).toEqual([]);
    expect(resolveListingStyles({ styles: [] })).toEqual([]);
    expect(resolveListingStyles({ styles: [null, "", "coquette", "nonsense"] })).toEqual([]);
  });

  it("drops unknown values, removes repeats, keeps the order and cuts to 3", () => {
    expect(
      resolveListingStyles({
        styles: ["y2k", "unknown", "y2k", " Vintage ", "quiet-luxury", "goth", "boho"],
      }),
    ).toEqual(["y2k", "vintage", "quiet_luxury"]);
    expect(resolveListingStyles({ styles: [...LISTING_STYLES] })).toHaveLength(LISTING_STYLES_MAX);
  });

  it("explains every style to the model, and the answer shape accepts a missing styles list", () => {
    for (const style of LISTING_STYLES) expect(LISTING_CHECK_INSTRUCTIONS).toContain(`- ${style}:`);
    expect(rawListingCheckSchema.parse({ flags: [] })).toEqual({ flags: [] });
    expect(rawListingCheckSchema.parse({ flags: [], styles: ["y2k"] }).styles).toEqual(["y2k"]);
  });
});

/** A database that answers the one query of the catch-up with these rows. */
const dbWith = (rows: { id: string; adminUpload: string | null }[]) => {
  const limit = vi.fn(async () => rows);
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "from", "leftJoin", "where", "orderBy"]) chain[name] = () => chain;
  chain.limit = limit;
  return { app: { db: chain as never }, limit };
};
const log = { info: () => undefined, warn: () => undefined };

describe("the nightly style catch-up (D-040)", () => {
  it("checks each untagged listing once, with flags on for members and off for admin uploads", async () => {
    const { app, limit } = dbWith([
      { id: "a", adminUpload: null },
      { id: "b", adminUpload: "b" },
    ]);
    const checker = vi.fn<ListingChecker>(async () => "checked");
    expect(await tagUntaggedListings(app, checker, log)).toEqual({
      tagged: 2,
      failed: 0,
      stoppedEarly: false,
    });
    expect(limit).toHaveBeenCalledWith(STYLE_CATCH_UP_LIMIT);
    expect(STYLE_CATCH_UP_LIMIT).toBe(100);
    expect(checker.mock.calls.map(([call]) => [call.listingId, call.flags])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("passes a smaller limit on, and counts failures without stopping", async () => {
    const { app, limit } = dbWith([
      { id: "a", adminUpload: null },
      { id: "b", adminUpload: null },
    ]);
    const checker = vi.fn<ListingChecker>(async ({ listingId }) =>
      listingId === "a" ? "failed" : "checked",
    );
    expect(await tagUntaggedListings(app, checker, log, 5)).toEqual({
      tagged: 1,
      failed: 1,
      stoppedEarly: false,
    });
    expect(limit).toHaveBeenCalledWith(5);
  });

  it("stops at the first refusal, and when the AI is off", async () => {
    const rows = [
      { id: "a", adminUpload: null },
      { id: "b", adminUpload: null },
      { id: "c", adminUpload: null },
    ];
    const refused = vi.fn<ListingChecker>(async ({ listingId }) =>
      listingId === "b" ? "refused" : "checked",
    );
    expect(await tagUntaggedListings(dbWith(rows).app, refused, log)).toEqual({
      tagged: 1,
      failed: 0,
      stoppedEarly: true,
    });
    expect(refused).toHaveBeenCalledTimes(2);
    const off = vi.fn<ListingChecker>(async () => "off");
    expect((await tagUntaggedListings(dbWith(rows).app, off, log)).stoppedEarly).toBe(true);
    expect(off).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no listing needs tags", async () => {
    const checker = vi.fn<ListingChecker>(async () => "checked");
    expect(await tagUntaggedListings(dbWith([]).app, checker, log)).toEqual({
      tagged: 0,
      failed: 0,
      stoppedEarly: false,
    });
    expect(checker).not.toHaveBeenCalled();
  });
});

describe("the checker without a database", () => {
  it("says off when no key is set", async () => {
    const { createListingChecker } = await import("./listing-check.js");
    const checker = createListingChecker({} as never, fakeListingCheckReader());
    expect(await checker({ listingId: "x", log })).toBe("off");
  });

  it("tells a refusal from the AI meter apart from other failures", async () => {
    const { createListingChecker } = await import("./listing-check.js");
    const row = { id: "x", status: "active", sellerId: "s", title: "t", description: "", brandName: null };
    // First query reads the listing, the second its photos (none).
    let answers: object[][] = [];
    const reset = () => (answers = [[row], []]);
    reset();
    const query = () => {
      const q: Record<string, unknown> = { limit: async () => answers.shift() ?? [] };
      for (const name of ["from", "where", "orderBy"]) q[name] = () => q;
      return q;
    };
    const app = {
      db: { select: query },
      reference: { get: async () => ({ categories: [] }) },
      storage: { read: async () => Buffer.from("") },
    } as never;
    const refusing = {
      enabled: true,
      read: async () => {
        throw new AiRefusedError("switch_off", "off");
      },
    };
    expect(await createListingChecker(app, refusing)({ listingId: "x", log })).toBe("refused");
    reset();
    const broken = {
      enabled: true,
      read: async () => {
        throw new Error("model down");
      },
    };
    expect(await createListingChecker(app, broken)({ listingId: "x", log })).toBe("failed");
  });
});
