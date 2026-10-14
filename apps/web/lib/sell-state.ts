import {
  type CategoryNode,
  type ListingDetail,
  type ListingDraftInput,
  minorToPriceText,
  priceTextToMinor,
  type ReferenceData,
  stripHiddenAttributes,
} from "@vinty/shared";

export type SellPhoto = {
  /** Local id for the tile. */
  id: string;
  /** What the tile shows: the shrunk local picture, or the stored photo's address when editing. */
  url: string;
  width: number;
  height: number;
  /** Set once the file is in storage. */
  key?: string;
  state: "uploading" | "done" | "failed";
  progress: number;
};

export type SellValues = {
  title: string;
  description: string;
  categoryId: string | null;
  /** `id` is null for a brand the seller typed that is not on our list. */
  brand: { id: string | null; name: string } | null;
  sizeId: string | null;
  conditionId: string | null;
  colourIds: string[];
  materialId: string | null;
  patternId: string | null;
  parcelSizeId: string | null;
  /** True once the seller picked a parcel size, so a category change no longer replaces it. */
  parcelChosen: boolean;
  priceText: string;
  photos: SellPhoto[];
};

export const EMPTY_SELL_VALUES: SellValues = {
  title: "",
  description: "",
  categoryId: null,
  brand: null,
  sizeId: null,
  conditionId: null,
  colourIds: [],
  materialId: null,
  patternId: null,
  parcelSizeId: null,
  parcelChosen: false,
  priceText: "",
  photos: [],
};

let counter = 0;
export const newPhotoId = () => {
  counter += 1;
  return `p${Date.now().toString(36)}${counter}`;
};

/** The form's values for an existing draft or listing. */
export function valuesFromListing(listing: ListingDetail): SellValues {
  return {
    title: listing.title,
    description: listing.description,
    categoryId: listing.category?.id ?? null,
    brand: listing.brand,
    sizeId: listing.size?.id ?? null,
    conditionId: listing.condition?.id ?? null,
    colourIds: listing.colours.map((c) => c.id),
    materialId: listing.material?.id ?? null,
    patternId: listing.pattern?.id ?? null,
    parcelSizeId: listing.parcelSizeId,
    parcelChosen: Boolean(listing.parcelSizeId),
    priceText: minorToPriceText(listing.priceMinor),
    photos: listing.photos.map((p) => ({
      id: newPhotoId(),
      url: p.url,
      width: p.width,
      height: p.height,
      key: p.key,
      state: "done" as const,
      progress: 1,
    })),
  };
}

/** What the server receives. Photos that have not finished uploading are left out. */
export function toListingInput(values: SellValues): ListingDraftInput {
  return {
    title: values.title,
    description: values.description,
    categoryId: values.categoryId,
    brandId: values.brand?.id ?? null,
    brandName: values.brand && !values.brand.id ? values.brand.name : null,
    sizeId: values.sizeId,
    conditionId: values.conditionId,
    colourIds: values.colourIds,
    materialId: values.materialId,
    patternId: values.patternId,
    parcelSizeId: values.parcelSizeId,
    priceMinor: priceTextToMinor(values.priceText),
    usedAiPhotos: false,
    photos: values.photos
      .filter((p) => p.state === "done" && p.key)
      .map((p) => ({
        key: p.key as string,
        width: p.width,
        height: p.height,
        contentType: "image/jpeg" as const,
      })),
  };
}

/**
 * What changes when a leaf category is chosen: rows the new category hides are emptied, a size from another size chart is
 * dropped, and the category's parcel size is suggested until the seller picked one (same as the app).
 */
export function categoryChoicePatch(
  values: SellValues,
  leaf: CategoryNode,
  reference: ReferenceData,
): Partial<SellValues> {
  const cleaned = stripHiddenAttributes(
    {
      brandId: values.brand?.id ?? null,
      brandName: values.brand && !values.brand.id ? values.brand.name : null,
      sizeId: values.sizeId,
      conditionId: values.conditionId,
      colourIds: values.colourIds,
      materialId: values.materialId,
      patternId: values.patternId,
    },
    leaf,
  );
  const sizeFits =
    cleaned.sizeId &&
    reference.sizeGroups.some(
      (g) => leaf.sizeGroupIds.includes(g.id) && g.sizes.some((s) => s.id === cleaned.sizeId),
    );
  return {
    categoryId: leaf.id,
    brand: cleaned.brandId || cleaned.brandName ? values.brand : null,
    sizeId: sizeFits ? cleaned.sizeId : null,
    conditionId: cleaned.conditionId ?? null,
    colourIds: [...(cleaned.colourIds ?? [])],
    materialId: cleaned.materialId ?? null,
    patternId: cleaned.patternId ?? null,
    ...(values.parcelChosen
      ? {}
      : { parcelSizeId: leaf.defaultParcelSizeId ?? reference.parcelSizes[0]?.id ?? null }),
  };
}
