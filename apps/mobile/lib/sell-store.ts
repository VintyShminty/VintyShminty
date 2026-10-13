import type {
  ListingDetail,
  ListingDraftInput,
  ListingFieldErrors,
  ListingStatus,
  PhotoSuggestion,
  ReferenceData,
} from "@vinty/shared";
import { create } from "zustand";
import { minorToPriceText, priceTextToMinor } from "@/lib/money";
import { planSuggestion, type SuggestedField } from "@/lib/sell-assist-plan";

export type SellPhoto = {
  /** Local id for the tile. */
  id: string;
  /** What the tile shows: the shrunk local file, or the stored photo's address when editing. */
  uri: string;
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
  brand: { id: string; name: string } | null;
  sizeId: string | null;
  conditionId: string | null;
  colourIds: string[];
  materialId: string | null;
  patternId: string | null;
  parcelSizeId: string | null;
  /** True once the seller picked a parcel size, so a category change no longer replaces it. */
  parcelChosen: boolean;
  priceText: string;
  usedAiPhotos: boolean;
  photos: SellPhoto[];
};

const EMPTY: SellValues = {
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
  usedAiPhotos: false,
  photos: [],
};

type SellState = {
  /** The listing being edited or the draft being resumed. Undefined for a new listing. */
  listingId?: string;
  status?: ListingStatus;
  values: SellValues;
  dirty: boolean;
  errors: ListingFieldErrors;
  /** The photo helper: not asked yet, reading the photos, or finished (with or without an answer). */
  assist: "idle" | "reading" | "done";
  /** Fields the helper filled that the seller has not touched yet. They carry a "Suggested" mark. */
  suggested: SuggestedField[];
  /** Counts up on every start(), so a late answer for an earlier form is thrown away. */
  session: number;
  setAssist: (assist: "idle" | "reading" | "done") => void;
  finishAssist: (session: number) => void;
  applyPhotoSuggestion: (session: number, suggestion: PhotoSuggestion, reference: ReferenceData) => void;
  start: (listing?: ListingDetail) => void;
  set: (patch: Partial<SellValues>) => void;
  updatePhoto: (id: string, patch: Partial<SellPhoto>) => void;
  setErrors: (errors: ListingFieldErrors) => void;
  clearError: (field: keyof ListingFieldErrors) => void;
};

let counter = 0;
export const newPhotoId = () => {
  counter += 1;
  return `p${Date.now().toString(36)}${counter}`;
};

/**
 * The sell form's values while the person moves between the form, the category panels and the pickers.
 * Small app state, so it lives in Zustand. The saved listing itself comes from the server.
 */
/** Which "Suggested" mark goes away when the seller changes a value. */
const SUGGESTED_BY_VALUE: Partial<Record<keyof SellValues, SuggestedField>> = {
  title: "title",
  description: "description",
  categoryId: "category",
  brand: "brand",
  colourIds: "colours",
  materialId: "material",
};

export const useSellStore = create<SellState>((set, get) => ({
  values: EMPTY,
  dirty: false,
  errors: {},
  assist: "idle",
  suggested: [],
  session: 0,
  setAssist: (assist) => set({ assist }),
  finishAssist: (session) => set((s) => (s.session === session ? { assist: "done" } : s)),
  applyPhotoSuggestion: (session, suggestion, reference) => {
    if (get().session !== session) return;
    // Plans against the values as they are now, so anything the seller chose while it was reading stays theirs.
    const { patch, fields } = planSuggestion(get().values, suggestion, reference);
    set((s) => ({
      assist: "done",
      values: { ...s.values, ...patch },
      suggested: [...s.suggested.filter((f) => !fields.includes(f)), ...fields],
      dirty: s.dirty || fields.length > 0,
    }));
  },
  start: (listing) =>
    set((s) => ({
      assist: "idle",
      suggested: [],
      session: s.session + 1,
      listingId: listing?.id,
      status: listing?.status,
      dirty: false,
      errors: {},
      values: listing
        ? {
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
            usedAiPhotos: listing.usedAiPhotos,
            photos: listing.photos.map((p) => ({
              id: newPhotoId(),
              uri: p.url,
              width: p.width,
              height: p.height,
              key: p.key,
              state: "done" as const,
              progress: 1,
            })),
          }
        : EMPTY,
    })),
  set: (patch) =>
    set((s) => {
      // Only a real change counts as touching it (choosing a category rewrites the other rows with the same values).
      const touched = (Object.keys(patch) as (keyof SellValues)[])
        .filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(s.values[k]))
        .map((k) => SUGGESTED_BY_VALUE[k]);
      return {
        values: { ...s.values, ...patch },
        dirty: true,
        suggested: s.suggested.filter((f) => !touched.includes(f)),
      };
    }),
  updatePhoto: (id, patch) =>
    set((s) => ({
      values: { ...s.values, photos: s.values.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) },
    })),
  setErrors: (errors) => set({ errors }),
  clearError: (field) =>
    set((s) => {
      if (!s.errors[field]) return s;
      const next = { ...s.errors };
      delete next[field];
      return { errors: next };
    }),
}));

/** What the server receives. Photos that have not finished uploading are left out. */
export function toListingInput(values: SellValues): ListingDraftInput {
  return {
    title: values.title,
    description: values.description,
    categoryId: values.categoryId,
    brandId: values.brand?.id ?? null,
    sizeId: values.sizeId,
    conditionId: values.conditionId,
    colourIds: values.colourIds,
    materialId: values.materialId,
    patternId: values.patternId,
    parcelSizeId: values.parcelSizeId,
    priceMinor: priceTextToMinor(values.priceText),
    usedAiPhotos: values.usedAiPhotos,
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
