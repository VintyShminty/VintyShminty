import { describe, expect, it } from "vitest";
import { VALIDATION_MESSAGES } from "./auth.js";
import {
  allowedSizeIds,
  categoryTrail,
  findCategory,
  LISTING_PRICE_MAX_MINOR,
  LISTING_VALIDATION_MESSAGES,
  listingLimits,
  stripHiddenAttributes,
  validateListing,
} from "./listing-rules.js";
import { createListingInputSchema, listingDraftInputSchema, pricePreviewQuerySchema } from "./listings.js";
import type { CategoryNode, ReferenceData } from "./reference-data.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const name = (en: string) => ({ en, he: en });

const rules = (over: Partial<CategoryNode["rules"]> = {}): CategoryNode["rules"] => ({
  brand: "optional",
  size: "hidden",
  condition: "required",
  colour: "optional",
  material: "hidden",
  pattern: "hidden",
  ...over,
});
const node = (n: number, slug: string, over: Partial<CategoryNode> = {}): CategoryNode => ({
  id: id(n),
  slug,
  path: slug,
  name: name(slug),
  icon: null,
  isLeaf: true,
  rules: rules(),
  sizeGroupIds: [],
  defaultParcelSizeId: null,
  children: [],
  ...over,
});

const dresses = node(11, "dresses", {
  rules: rules({ brand: "required", size: "required", material: "optional" }),
  sizeGroupIds: [id(500)],
});
const books = node(12, "books", { rules: rules({ brand: "hidden", colour: "hidden" }) });
const women = node(10, "women", { isLeaf: false, children: [dresses] });

const reference: Pick<
  ReferenceData,
  | "categories"
  | "sizeGroups"
  | "conditions"
  | "colours"
  | "materials"
  | "patterns"
  | "parcelSizes"
  | "settings"
> = {
  categories: [women, books],
  sizeGroups: [
    {
      id: id(500),
      slug: "letters",
      name: name("Letters"),
      kind: "letter",
      sizes: [{ id: id(501), slug: "m", label: "M", name: name("M") }],
    },
    {
      id: id(510),
      slug: "shoes",
      name: name("Shoes"),
      kind: "shoe",
      sizes: [{ id: id(511), slug: "40", label: "40", name: name("40") }],
    },
  ],
  conditions: [{ id: id(600), slug: "good", name: name("Good"), description: name("Good"), rank: 3 }],
  colours: [1, 2, 3].map((n) => ({ id: id(700 + n), slug: `c${n}`, name: name("c"), swatchHex: "#000000" })),
  materials: [{ id: id(800), slug: "cotton", name: name("Cotton") }],
  patterns: [{ id: id(900), slug: "solid", name: name("Solid") }],
  parcelSizes: [
    {
      id: id(950),
      slug: "small",
      name: name("Small"),
      description: name("Small"),
      maxWeightGrams: 2000,
      priceMinor: 1400,
      currency: "ILS",
    },
  ],
  settings: { listing_max_photos: 5, listing_min_price_minor: 100 },
};

const complete = {
  title: "Blue dress",
  categoryId: dresses.id,
  brandId: id(1),
  sizeId: id(501),
  conditionId: id(600),
  priceMinor: 4500,
  parcelSizeId: id(950),
  photoCount: 3,
};

describe("listing rules", () => {
  it("accepts a complete listing", () => {
    expect(validateListing(complete, reference, { publish: true })).toEqual({});
  });

  it("asks for everything a dress needs, in the field order of the form", () => {
    const errors = validateListing({}, reference, { publish: true });
    expect(errors).toMatchObject({
      title: "validation.listing.title.required",
      photos: "validation.listing.photos.required",
      categoryId: "validation.listing.category.required",
      priceMinor: "validation.listing.price.required",
      parcelSizeId: "validation.listing.parcel.required",
    });
  });

  it("requires a brand and a size only where the category says so", () => {
    const dress = validateListing({ ...complete, brandId: null, sizeId: null }, reference, { publish: true });
    expect(dress.brandId).toBe("validation.listing.brand.required");
    expect(dress.sizeId).toBe("validation.listing.size.required");

    const book = validateListing(
      { ...complete, categoryId: books.id, brandId: null, sizeId: null },
      reference,
      { publish: true },
    );
    expect(book).toEqual({});
  });

  it("rejects a size that belongs to another category's size group", () => {
    const errors = validateListing({ ...complete, sizeId: id(511) }, reference, { publish: true });
    expect(errors.sizeId).toBe("validation.listing.size.invalid");
    expect(allowedSizeIds(reference, dresses)).toEqual(new Set([id(501)]));
  });

  it("limits the title, colours, photos and price", () => {
    const errors = validateListing(
      {
        ...complete,
        title: "ab",
        colourIds: [id(701), id(702), id(703)],
        photoCount: 6,
        priceMinor: 50,
      },
      reference,
      { publish: true },
    );
    expect(errors).toMatchObject({
      title: "validation.listing.title.tooShort",
      colourIds: "validation.listing.colour.tooMany",
      photos: "validation.listing.photos.tooMany",
      priceMinor: "validation.listing.price.tooLow",
    });
    expect(
      validateListing({ ...complete, priceMinor: LISTING_PRICE_MAX_MINOR + 1 }, reference, { publish: true })
        .priceMinor,
    ).toBe("validation.listing.price.tooHigh");
  });

  it("lets a draft be unfinished but not impossible", () => {
    expect(validateListing({ title: "x" }, reference, { publish: false })).toEqual({});
    expect(validateListing({ title: "x".repeat(81) }, reference, { publish: false }).title).toBe(
      "validation.listing.title.tooLong",
    );
    expect(validateListing({ categoryId: id(99999) }, reference, { publish: false }).categoryId).toBe(
      "validation.listing.category.invalid",
    );
    // A branch is not a place to put an item.
    expect(validateListing({ categoryId: women.id }, reference, { publish: false }).categoryId).toBe(
      "validation.listing.category.invalid",
    );
  });

  it("drops values for rows the category hides", () => {
    const cleaned = stripHiddenAttributes({ brandId: id(1), colourIds: [id(701)], sizeId: id(501) }, books);
    expect(cleaned).toEqual({ brandId: null, colourIds: [], sizeId: null });
  });

  it("finds categories and their trail, and reads limits with defaults", () => {
    expect(findCategory(reference.categories, dresses.id)?.slug).toBe("dresses");
    expect(categoryTrail(reference.categories, dresses.id).map((c) => c.slug)).toEqual(["women", "dresses"]);
    expect(listingLimits(reference)).toEqual({ maxPhotos: 5, minPriceMinor: 100 });
    expect(listingLimits({ settings: {} })).toEqual({ maxPhotos: 20, minPriceMinor: 100 });
  });

  it("has a translation key list that covers every message the rules can return", () => {
    for (const key of LISTING_VALIDATION_MESSAGES) expect(VALIDATION_MESSAGES).toContain(key);
    const errors = validateListing({ title: "ab", priceMinor: 1 }, reference, { publish: true });
    for (const key of Object.values(errors)) expect(VALIDATION_MESSAGES).toContain(key);
  });
});

describe("listing input schemas", () => {
  it("takes an empty draft and defaults publish to false", () => {
    expect(listingDraftInputSchema.safeParse({}).success).toBe(true);
    expect(createListingInputSchema.parse({}).publish).toBe(false);
  });

  it("answers with translation keys", () => {
    const result = listingDraftInputSchema.safeParse({ title: "x".repeat(81) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("validation.listing.title.tooLong");
  });

  it("reads the price preview query from text", () => {
    expect(pricePreviewQuerySchema.parse({ priceMinor: "4500" })).toEqual({
      priceMinor: 4500,
      currency: "ILS",
    });
    expect(pricePreviewQuerySchema.safeParse({ priceMinor: "-1" }).success).toBe(false);
  });
});
