import type {
  ListingDetail,
  ListingDraftInput,
  ListingFieldErrors,
  ListingStatus,
  PhotoSuggestion,
  PhotoTip,
  PhotoTipKind,
  TextSuggestion,
} from "@vinty/shared";
import { create } from "zustand";
import { minorToPriceText, priceTextToMinor } from "./money";

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
  /** What the helper saw. Never filled in, the pickers show it first as "Looks like". */
  suggestion: PhotoSuggestion | null;
  /** What the title and description suggest (D-036). Same rules as `suggestion`: shown first, never filled in. */
  textSuggestion: TextSuggestion | null;
  /** How many times the words were sent this session, and the text of the last time (so the same text is not sent twice). */
  textCalls: number;
  lastTextSent: string;
  /** Photo tips by photo key (D-036), the keys the helper already looked at, and the tips the seller closed. */
  photoTips: Record<string, PhotoTipKind[]>;
  checkedKeys: string[];
  dismissedTips: string[];
  /** Counts up on every start(), so a late answer for an earlier form is thrown away. */
  session: number;
  setAssist: (assist: "idle" | "reading" | "done") => void;
  finishAssist: (session: number) => void;
  receiveSuggestion: (session: number, suggestion: PhotoSuggestion) => void;
  receiveTextSuggestion: (session: number, suggestion: TextSuggestion) => void;
  /** Notes that the words are being sent now (one more call, and which text). */
  markTextSent: (session: number, text: string) => void;
  markChecked: (session: number, keys: string[]) => void;
  addPhotoTips: (session: number, tips: PhotoTip[]) => void;
  dismissTip: (key: string) => void;
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

/** Adds tips to the ones we have, by photo key. */
function withTips(current: Record<string, PhotoTipKind[]>, tips: PhotoTip[]) {
  const next = { ...current };
  for (const tip of tips) next[tip.key] = tip.kinds;
  return next;
}

/**
 * The sell form's values while the person moves between the form, the category panels and the pickers.
 * Small app state, so it lives in Zustand. The saved listing itself comes from the server.
 */
export const useSellStore = create<SellState>((set) => ({
  values: EMPTY,
  dirty: false,
  errors: {},
  assist: "idle",
  suggestion: null,
  textSuggestion: null,
  textCalls: 0,
  lastTextSent: "",
  photoTips: {},
  checkedKeys: [],
  dismissedTips: [],
  session: 0,
  setAssist: (assist) => set({ assist }),
  finishAssist: (session) => set((s) => (s.session === session ? { assist: "done" } : s)),
  receiveSuggestion: (session, suggestion) =>
    set((s) =>
      s.session === session
        ? { assist: "done", suggestion, photoTips: withTips(s.photoTips, suggestion.photoTips) }
        : s,
    ),
  receiveTextSuggestion: (session, textSuggestion) =>
    set((s) => (s.session === session ? { textSuggestion } : s)),
  markTextSent: (session, text) =>
    set((s) => (s.session === session ? { textCalls: s.textCalls + 1, lastTextSent: text } : s)),
  markChecked: (session, keys) =>
    set((s) =>
      s.session === session
        ? { checkedKeys: [...s.checkedKeys, ...keys.filter((k) => !s.checkedKeys.includes(k))] }
        : s,
    ),
  addPhotoTips: (session, tips) =>
    set((s) => (s.session === session ? { photoTips: withTips(s.photoTips, tips) } : s)),
  dismissTip: (key) => set((s) => ({ dismissedTips: [...s.dismissedTips, key] })),
  start: (listing) =>
    set((s) => ({
      assist: "idle",
      suggestion: null,
      textSuggestion: null,
      textCalls: 0,
      lastTextSent: "",
      photoTips: {},
      checkedKeys: [],
      dismissedTips: [],
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
  set: (patch) => set((s) => ({ values: { ...s.values, ...patch }, dirty: true })),
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
    brandName: values.brand && !values.brand.id ? values.brand.name : null,
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
