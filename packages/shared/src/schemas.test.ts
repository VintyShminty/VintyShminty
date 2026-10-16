import { describe, expect, it } from "vitest";
import { errorResponseSchema, paginationQuerySchema } from "./common.js";
import { createListingInputSchema, searchFiltersSchema } from "./listings.js";
import { bundleSavedMinor, updateBundleLadderInputSchema } from "./orders.js";
import { addressInputSchema, usernameSchema } from "./users.js";

describe("shared schemas", () => {
  it("accepts a draft with almost nothing filled in", () => {
    expect(createListingInputSchema.safeParse({ title: "Blue jeans" }).success).toBe(true);
  });

  it("rejects more than two colours on a listing", () => {
    const id = "6f1c1c1e-5c1d-4d52-9f4a-111111111111";
    expect(createListingInputSchema.safeParse({ colourIds: [id, id, id] }).success).toBe(false);
  });

  it("defaults pagination and search sort", () => {
    expect(paginationQuerySchema.parse({}).limit).toBe(20);
    expect(searchFiltersSchema.parse({}).sort).toBe("relevance");
  });

  it("limits usernames to safe characters", () => {
    expect(usernameSchema.safeParse("dana_levi").success).toBe(true);
    expect(usernameSchema.safeParse("no spaces").success).toBe(false);
  });

  it("defaults addresses to Israel", () => {
    const parsed = addressInputSchema.parse({
      fullName: "A B",
      line1: "Herzl 1",
      city: "Haifa",
      postcode: "3303",
    });
    expect(parsed.countryCode).toBe("IL");
  });

  it("describes errors in one shape", () => {
    expect(
      errorResponseSchema.safeParse({ error: { code: "not_found", message: "No such item" } }).success,
    ).toBe(true);
  });
});

describe("bundle ladder input", () => {
  const tier = (minItems: number, percentOff: number) => ({ minItems, percentOff });
  const ok = (tiers: ReturnType<typeof tier>[]) =>
    updateBundleLadderInputSchema.safeParse({ on: true, tiers }).success;

  it("takes 1 to 5 steps that grow in items and percent", () => {
    expect(ok([tier(2, 5)])).toBe(true);
    expect(ok([tier(2, 5), tier(3, 10), tier(5, 15)])).toBe(true);
    expect(ok([])).toBe(false);
    expect(ok([tier(2, 5), tier(3, 5)])).toBe(false);
    expect(ok([tier(3, 5), tier(3, 10)])).toBe(false);
    expect(ok([tier(1, 5)])).toBe(false);
    expect(ok([tier(21, 5)])).toBe(false);
    expect(ok([tier(2, 51)])).toBe(false);
    expect(ok([2, 3, 4, 5, 6, 7].map((n) => tier(n, n)))).toBe(false);
  });

  it("adds the discount and the postage saved", () => {
    expect(
      bundleSavedMinor({ discountMinor: 3700, postageSeparateMinor: 4600, postageTogetherMinor: 1800 }),
    ).toBe(6500);
    expect(
      bundleSavedMinor({ discountMinor: 0, postageSeparateMinor: 1800, postageTogetherMinor: 1800 }),
    ).toBe(0);
  });
});
