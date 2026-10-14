import { describe, expect, it } from "vitest";
import { flattenCategories } from "./reference/categories.js";

// The sell form no longer shows a Pattern row. That is safe only while no category requires a pattern, because the
// server would then reject every listing in it. Search filters keep Pattern.
describe("category rules", () => {
  it("never require a pattern", () => {
    const required = flattenCategories().filter((c) => c.rules.pattern === "required");
    expect(required.map((c) => c.slug)).toEqual([]);
  });
});
