import { describe, expect, it } from "vitest";
import { createReportInputSchema, feedQuerySchema, searchQuerySchema } from "./discovery.js";

const id = "3f2b8f0e-6a52-4f7e-9d27-0c1c2b8a1e11";
const id2 = "4f2b8f0e-6a52-4f7e-9d27-0c1c2b8a1e12";

describe("discovery schemas", () => {
  it("reads id lists as commas or repeated keys, and numbers from text", () => {
    const parsed = searchQuerySchema.parse({
      brandIds: `${id},${id2}`,
      sizeIds: [id],
      priceMaxMinor: "5000",
    });
    expect(parsed.brandIds).toEqual([id, id2]);
    expect(parsed.sizeIds).toEqual([id]);
    expect(parsed.priceMaxMinor).toBe(5000);
    expect(parsed.sort).toBe("relevance");
    expect(parsed.limit).toBe(20);
  });

  it("refuses a bad id in a list", () => {
    expect(searchQuerySchema.safeParse({ brandIds: "nope" }).success).toBe(false);
  });

  it("reads trending as a flag", () => {
    expect(feedQuerySchema.parse({ trending: "true" }).trending).toBe(true);
    expect(feedQuerySchema.parse({}).trending).toBeUndefined();
  });

  it("limits report reasons and details", () => {
    expect(
      createReportInputSchema.safeParse({ targetType: "listing", targetId: id, reason: "spam" }).success,
    ).toBe(true);
    expect(
      createReportInputSchema.safeParse({ targetType: "listing", targetId: id, reason: "x" }).success,
    ).toBe(false);
  });
});
