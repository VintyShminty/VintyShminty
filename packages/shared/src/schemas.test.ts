import { describe, expect, it } from "vitest";
import { errorResponseSchema, paginationQuerySchema } from "./common.js";
import { createListingInputSchema, searchFiltersSchema } from "./listings.js";
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
