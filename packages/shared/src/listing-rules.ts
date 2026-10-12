import type { AttributeMode } from "./enums.js";
import type { CategoryNode, ReferenceData } from "./reference-data.js";

/**
 * The selling rules, written once and used by both the phone (inline errors while typing) and the server
 * (the real check). Every message is a translation key under `validation.listing`, like the account forms.
 * The rules come from the reference data: each category says which rows are required, optional or hidden.
 */

export const LISTING_TITLE_MIN = 3;
export const LISTING_TITLE_MAX = 80;
export const LISTING_DESCRIPTION_MAX = 2000;
export const LISTING_COLOURS_MAX = 2;
/** The ceiling on one item price, 50,000 shekels, to stop typing mistakes. */
export const LISTING_PRICE_MAX_MINOR = 5_000_000;
export const DEFAULT_MAX_PHOTOS = 20;
export const DEFAULT_MIN_PRICE_MINOR = 100;

/** Every key the listing rules can return. Merged into VALIDATION_MESSAGES so a test keeps both languages complete. */
export const LISTING_VALIDATION_MESSAGES = [
  "validation.listing.title.required",
  "validation.listing.title.tooShort",
  "validation.listing.title.tooLong",
  "validation.listing.description.tooLong",
  "validation.listing.photos.required",
  "validation.listing.photos.tooMany",
  "validation.listing.photos.invalid",
  "validation.listing.category.required",
  "validation.listing.category.invalid",
  "validation.listing.brand.required",
  "validation.listing.brand.invalid",
  "validation.listing.size.required",
  "validation.listing.size.invalid",
  "validation.listing.condition.required",
  "validation.listing.condition.invalid",
  "validation.listing.colour.required",
  "validation.listing.colour.tooMany",
  "validation.listing.colour.invalid",
  "validation.listing.material.required",
  "validation.listing.material.invalid",
  "validation.listing.pattern.required",
  "validation.listing.pattern.invalid",
  "validation.listing.price.required",
  "validation.listing.price.tooLow",
  "validation.listing.price.tooHigh",
  "validation.listing.parcel.required",
  "validation.listing.parcel.invalid",
  "validation.listing.currency.invalid",
  "validation.listing.notEditable",
] as const;

/** What the rules look at. Photos are counted, not inspected. */
export type ListingValues = {
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  sizeId?: string | null;
  conditionId?: string | null;
  materialId?: string | null;
  patternId?: string | null;
  colourIds?: readonly string[] | null;
  parcelSizeId?: string | null;
  priceMinor?: number | null;
  photoCount?: number;
};

export type ListingFieldErrors = Partial<Record<ListingField, string>>;
export type ListingField =
  | "title"
  | "description"
  | "photos"
  | "categoryId"
  | "brandId"
  | "sizeId"
  | "conditionId"
  | "colourIds"
  | "materialId"
  | "patternId"
  | "priceMinor"
  | "parcelSizeId";

export type ListingLimits = { maxPhotos: number; minPriceMinor: number };

/** Reads the two numbers that tune the form out of the reference settings, with safe defaults. */
export function listingLimits(reference: Pick<ReferenceData, "settings">): ListingLimits {
  const { listing_max_photos: photos, listing_min_price_minor: price } = reference.settings;
  return {
    maxPhotos: typeof photos === "number" ? photos : DEFAULT_MAX_PHOTOS,
    minPriceMinor: typeof price === "number" ? price : DEFAULT_MIN_PRICE_MINOR,
  };
}

/** Finds one node anywhere in the category tree. */
export function findCategory(tree: readonly CategoryNode[], id: string): CategoryNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const inChild = findCategory(node.children, id);
    if (inChild) return inChild;
  }
  return null;
}

/** The nodes from the top level down to the given category, or an empty list. */
export function categoryTrail(tree: readonly CategoryNode[], id: string): CategoryNode[] {
  for (const node of tree) {
    if (node.id === id) return [node];
    const below = categoryTrail(node.children, id);
    if (below.length > 0) return [node, ...below];
  }
  return [];
}

export type AttributeField = "brand" | "size" | "condition" | "colour" | "material" | "pattern";

/** What the category asks for. With no category chosen yet, nothing is shown. */
export function attributeMode(category: CategoryNode | null, field: AttributeField): AttributeMode {
  return category?.rules[field] ?? "hidden";
}

/** The sizes a category accepts, as ids. */
export function allowedSizeIds(reference: Pick<ReferenceData, "sizeGroups">, category: CategoryNode): Set<string> {
  const groups = new Set(category.sizeGroupIds);
  const ids = new Set<string>();
  for (const group of reference.sizeGroups) {
    if (groups.has(group.id)) for (const size of group.sizes) ids.add(size.id);
  }
  return ids;
}

/**
 * Removes values for rows the category hides, so a leftover brand from an earlier category choice is never saved.
 * Colours are cleared too when the category hides them.
 */
export function stripHiddenAttributes<T extends ListingValues>(
  values: T,
  category: CategoryNode | null,
): T {
  if (!category) return values;
  const next = { ...values };
  if (attributeMode(category, "brand") === "hidden" && "brandId" in next) next.brandId = null;
  if (attributeMode(category, "size") === "hidden" && "sizeId" in next) next.sizeId = null;
  if (attributeMode(category, "condition") === "hidden" && "conditionId" in next) next.conditionId = null;
  if (attributeMode(category, "colour") === "hidden" && "colourIds" in next) next.colourIds = [];
  if (attributeMode(category, "material") === "hidden" && "materialId" in next) next.materialId = null;
  if (attributeMode(category, "pattern") === "hidden" && "patternId" in next) next.patternId = null;
  return next;
}

/**
 * Checks a listing. `publish: true` is the full check for going live. `publish: false` is the lighter check for a
 * draft, which may be unfinished but must not hold impossible values.
 * Brand ids are not checked here (brands are not in the reference data), the server checks them.
 */
export function validateListing(
  values: ListingValues,
  reference: Pick<
    ReferenceData,
    "categories" | "sizeGroups" | "conditions" | "colours" | "materials" | "patterns" | "parcelSizes" | "settings"
  >,
  { publish }: { publish: boolean },
): ListingFieldErrors {
  const errors: ListingFieldErrors = {};
  const limits = listingLimits(reference);

  const title = (values.title ?? "").trim();
  if (title.length > LISTING_TITLE_MAX) errors.title = "validation.listing.title.tooLong";
  else if (publish && title.length === 0) errors.title = "validation.listing.title.required";
  else if (publish && title.length < LISTING_TITLE_MIN) errors.title = "validation.listing.title.tooShort";

  if ((values.description ?? "").trim().length > LISTING_DESCRIPTION_MAX) {
    errors.description = "validation.listing.description.tooLong";
  }

  const photoCount = values.photoCount ?? 0;
  if (photoCount > limits.maxPhotos) errors.photos = "validation.listing.photos.tooMany";
  else if (publish && photoCount < 1) errors.photos = "validation.listing.photos.required";

  let category: CategoryNode | null = null;
  if (values.categoryId) {
    category = findCategory(reference.categories, values.categoryId);
    if (!category || !category.isLeaf) errors.categoryId = "validation.listing.category.invalid";
  } else if (publish) {
    errors.categoryId = "validation.listing.category.required";
  }
  const rules = errors.categoryId ? null : category;

  // The value must exist, whatever the category says.
  if (values.conditionId && !reference.conditions.some((c) => c.id === values.conditionId)) {
    errors.conditionId = "validation.listing.condition.invalid";
  }
  if (values.materialId && !reference.materials.some((m) => m.id === values.materialId)) {
    errors.materialId = "validation.listing.material.invalid";
  }
  if (values.patternId && !reference.patterns.some((p) => p.id === values.patternId)) {
    errors.patternId = "validation.listing.pattern.invalid";
  }
  if (values.parcelSizeId && !reference.parcelSizes.some((p) => p.id === values.parcelSizeId)) {
    errors.parcelSizeId = "validation.listing.parcel.invalid";
  }
  const colourIds = values.colourIds ?? [];
  if (colourIds.length > LISTING_COLOURS_MAX) errors.colourIds = "validation.listing.colour.tooMany";
  else if (colourIds.some((id) => !reference.colours.some((c) => c.id === id))) {
    errors.colourIds = "validation.listing.colour.invalid";
  }

  if (rules && values.sizeId && attributeMode(rules, "size") !== "hidden") {
    if (!allowedSizeIds(reference, rules).has(values.sizeId)) errors.sizeId = "validation.listing.size.invalid";
  }

  if (values.priceMinor !== null && values.priceMinor !== undefined) {
    if (values.priceMinor > LISTING_PRICE_MAX_MINOR) errors.priceMinor = "validation.listing.price.tooHigh";
    else if (publish && values.priceMinor < limits.minPriceMinor) errors.priceMinor = "validation.listing.price.tooLow";
  } else if (publish) {
    errors.priceMinor = "validation.listing.price.required";
  }

  if (publish) {
    if (!values.parcelSizeId && !errors.parcelSizeId) errors.parcelSizeId = "validation.listing.parcel.required";
    // Required rows depend on the category. Without a valid category the category error already says what to do.
    if (rules) {
      const need = (field: AttributeField, has: boolean, key: string, target: ListingField) => {
        if (attributeMode(rules, field) === "required" && !has && !errors[target]) errors[target] = key;
      };
      need("brand", Boolean(values.brandId), "validation.listing.brand.required", "brandId");
      need("size", Boolean(values.sizeId), "validation.listing.size.required", "sizeId");
      need("condition", Boolean(values.conditionId), "validation.listing.condition.required", "conditionId");
      need("colour", colourIds.length > 0, "validation.listing.colour.required", "colourIds");
      need("material", Boolean(values.materialId), "validation.listing.material.required", "materialId");
      need("pattern", Boolean(values.patternId), "validation.listing.pattern.required", "patternId");
    }
  }
  return errors;
}
