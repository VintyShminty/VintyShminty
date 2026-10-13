import {
  attributeMode,
  findCategory,
  PHOTO_ASSIST_MIN_CONFIDENCE,
  type PhotoSuggestion,
  type ReferenceData,
} from "@vinty/shared";

/** The sell form fields the photo helper can fill, and the ones marked "Suggested" until the seller touches them. */
export type SuggestedField = "title" | "description" | "category" | "brand" | "colours" | "material";

/** The part of the sell form's values the plan looks at. */
export type PlanValues = {
  title: string;
  description: string;
  categoryId: string | null;
  brand: { id: string; name: string } | null;
  colourIds: string[];
  materialId: string | null;
  parcelChosen: boolean;
  parcelSizeId: string | null;
};

export type SuggestionPlan = {
  patch: Partial<{
    title: string;
    description: string;
    categoryId: string;
    brand: { id: string; name: string };
    colourIds: string[];
    materialId: string;
    parcelSizeId: string | null;
  }>;
  fields: SuggestedField[];
};

/**
 * Works out what to put in the form from a suggestion. It only fills what is empty, so nothing the seller already
 * chose is ever replaced, and only what the helper is sure of. Rows the chosen category hides are left alone.
 */
export function planSuggestion(
  values: PlanValues,
  suggestion: PhotoSuggestion,
  reference: Pick<ReferenceData, "categories" | "parcelSizes">,
): SuggestionPlan {
  const patch: SuggestionPlan["patch"] = {};
  const fields: SuggestedField[] = [];
  const sure = (confidence: number) => confidence >= PHOTO_ASSIST_MIN_CONFIDENCE;

  if (!values.title.trim() && suggestion.title) {
    patch.title = suggestion.title;
    fields.push("title");
  }
  if (!values.description.trim() && suggestion.description) {
    patch.description = suggestion.description;
    fields.push("description");
  }

  let category = values.categoryId ? findCategory(reference.categories, values.categoryId) : null;
  if (!values.categoryId && suggestion.categoryId && sure(suggestion.confidence.category)) {
    const leaf = findCategory(reference.categories, suggestion.categoryId);
    if (leaf?.isLeaf) {
      category = leaf;
      patch.categoryId = leaf.id;
      fields.push("category");
      // The category recommends a parcel size until the seller picks one (same as choosing it by hand).
      if (!values.parcelChosen) {
        patch.parcelSizeId = leaf.defaultParcelSizeId ?? reference.parcelSizes[0]?.id ?? null;
      }
    }
  }

  // Rows come after the category, because the category decides which rows exist.
  if (category) {
    if (!values.brand && suggestion.brand?.id && sure(suggestion.confidence.brand)) {
      if (attributeMode(category, "brand") !== "hidden") {
        patch.brand = { id: suggestion.brand.id, name: suggestion.brand.name };
        fields.push("brand");
      }
    }
    if (
      values.colourIds.length === 0 &&
      suggestion.colourIds.length > 0 &&
      sure(suggestion.confidence.colours)
    ) {
      if (attributeMode(category, "colour") !== "hidden") {
        patch.colourIds = suggestion.colourIds;
        fields.push("colours");
      }
    }
    if (!values.materialId && suggestion.materialId && sure(suggestion.confidence.material)) {
      if (attributeMode(category, "material") !== "hidden") {
        patch.materialId = suggestion.materialId;
        fields.push("material");
      }
    }
  }
  return { patch, fields };
}
