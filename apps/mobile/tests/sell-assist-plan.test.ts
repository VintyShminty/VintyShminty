import { EMPTY_PHOTO_SUGGESTION, type PhotoSuggestion, type ReferenceData } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { type PlanValues, planSuggestion } from "../lib/sell-assist-plan";

const rules = (over: Record<string, string> = {}) => ({
  brand: "optional",
  size: "required",
  condition: "required",
  colour: "required",
  material: "optional",
  pattern: "hidden",
  ...over,
});
const leaf = (id: string, over: Record<string, string> = {}) => ({
  id,
  isLeaf: true,
  rules: rules(over),
  children: [],
  defaultParcelSizeId: `parcel-${id}`,
});
const reference = {
  categories: [
    {
      id: "root",
      isLeaf: false,
      rules: rules(),
      children: [leaf("dress"), leaf("bag", { brand: "hidden", colour: "hidden", material: "hidden" })],
    },
  ],
  parcelSizes: [{ id: "parcel-small" }],
} as unknown as Pick<ReferenceData, "categories" | "parcelSizes">;

const empty: PlanValues = {
  title: "",
  description: "",
  categoryId: null,
  brand: null,
  colourIds: [],
  materialId: null,
  parcelChosen: false,
  parcelSizeId: "parcel-small",
};
const full = (over: Partial<PhotoSuggestion> = {}): PhotoSuggestion => ({
  categoryId: "dress",
  brand: { id: "b1", name: "Zara" },
  colourIds: ["red"],
  materialId: "cotton",
  title: "Red dress",
  description: "A red dress.",
  confidence: { category: 0.9, brand: 0.9, colours: 0.9, material: 0.9 },
  ...over,
});

describe("planSuggestion", () => {
  it("fills every empty field and marks them all", () => {
    const { patch, fields } = planSuggestion(empty, full(), reference);
    expect(patch).toMatchObject({
      title: "Red dress",
      description: "A red dress.",
      categoryId: "dress",
      brand: { id: "b1", name: "Zara" },
      colourIds: ["red"],
      materialId: "cotton",
      parcelSizeId: "parcel-dress",
    });
    expect(fields.sort()).toEqual(["brand", "category", "colours", "description", "material", "title"]);
  });

  it("never replaces something the seller already chose", () => {
    const mine: PlanValues = {
      ...empty,
      title: "My own title",
      description: "Mine",
      categoryId: "dress",
      brand: { id: "b2", name: "Mango" },
      colourIds: ["blue"],
      materialId: "linen",
    };
    expect(planSuggestion(mine, full({ categoryId: "bag" }), reference)).toEqual({ patch: {}, fields: [] });
  });

  it("keeps the parcel size the seller picked", () => {
    const { patch } = planSuggestion({ ...empty, parcelChosen: true }, full(), reference);
    expect(patch.parcelSizeId).toBeUndefined();
  });

  it("skips fields it is not sure of", () => {
    const { patch, fields } = planSuggestion(
      empty,
      full({ confidence: { category: 0.3, brand: 0.9, colours: 0.2, material: 0.1 } }),
      reference,
    );
    expect(patch.categoryId).toBeUndefined();
    // Without a category there are no rows to fill.
    expect(patch.brand).toBeUndefined();
    expect(fields).toEqual(["title", "description"]);
  });

  it("does not fill rows the category hides", () => {
    const { patch, fields } = planSuggestion(empty, full({ categoryId: "bag" }), reference);
    expect(patch.categoryId).toBe("bag");
    expect(patch.brand).toBeUndefined();
    expect(patch.colourIds).toBeUndefined();
    expect(patch.materialId).toBeUndefined();
    expect(fields).toContain("category");
    expect(fields).not.toContain("brand");
  });

  it("ignores a category that is not a real leaf, and a brand we could not match", () => {
    const { patch } = planSuggestion(
      empty,
      full({ categoryId: "root", brand: { id: null, name: "Obscure" } }),
      reference,
    );
    expect(patch.categoryId).toBeUndefined();
    expect(patch.brand).toBeUndefined();
  });

  it("does nothing for an empty suggestion", () => {
    expect(planSuggestion(empty, EMPTY_PHOTO_SUGGESTION, reference)).toEqual({ patch: {}, fields: [] });
  });
});
