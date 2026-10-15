import {
  type AdminListingItemInput,
  type AdminPublishResult,
  buildPublishItem,
  findCategory,
  LISTING_COLOURS_MAX,
  type ListingField,
  type ListingFieldErrors,
  listingValuesOf,
  type PhotoSuggestion,
  priceTextToMinor,
  type ReferenceData,
  sizeOptionsFor,
  type UploadItemFields,
  validateListing,
} from "@vinty/shared";

/**
 * The phone's batch upload, without any screen in it: the tray of loose photos, tapping to select, grouping the
 * selection into an item, what makes an item complete (the shared listing rules), and what is sent to the server.
 */

export type UploadPhoto = {
  id: string;
  /** A picture on this phone, shown while it uploads and afterwards. */
  uri: string;
  width: number;
  height: number;
  state: "uploading" | "done" | "failed";
  /** 0 to 1. */
  progress: number;
  key?: string;
};

export type SuggestionState = "idle" | "loading" | "done" | "none";

export type UploadItem = {
  id: string;
  photos: UploadPhoto[];
  title: string;
  categoryId: string | null;
  brandId: string | null;
  /** The brand as written. Equals the listed brand's name when `brandId` is set. */
  brandText: string;
  sizeId: string | null;
  conditionId: string | null;
  colourIds: string[];
  /** The price as typed, in shekels. */
  priceText: string;
  suggestion: SuggestionState;
  /** Fields the AI filled in that nobody edited yet. */
  suggested: { category: boolean; brand: boolean; colours: boolean };
  state: "draft" | "publishing" | "failed" | "published";
  error: string | null;
  failedFields: Record<string, string> | null;
  listingId: string | null;
};

export type UploadState = {
  /** Photos not in any item yet. */
  tray: UploadPhoto[];
  /** Tray photo ids in the order they were tapped. */
  selected: string[];
  items: UploadItem[];
};

export const initialUploadState: UploadState = { tray: [], selected: [], items: [] };

let counter = 0;
/** A short id, unique while the app runs. */
export const newUploadId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function newItem(photos: UploadPhoto[]): UploadItem {
  return {
    id: newUploadId("item"),
    photos,
    title: "",
    categoryId: null,
    brandId: null,
    brandText: "",
    sizeId: null,
    conditionId: null,
    colourIds: [],
    priceText: "",
    suggestion: "idle",
    suggested: { category: false, brand: false, colours: false },
    state: "draft",
    error: null,
    failedFields: null,
    listingId: null,
  };
}

// Readiness

export type ItemProblems = {
  fields: ListingFieldErrors;
  photos: "uploading" | "failed" | null;
  any: boolean;
};

const priceMinorOf = (item: Pick<UploadItem, "priceText">) => priceTextToMinor(item.priceText);

function fieldsOf(item: UploadItem): UploadItemFields {
  return {
    title: item.title,
    description: "",
    categoryId: item.categoryId,
    brandId: item.brandId,
    brandText: item.brandText,
    sizeId: item.sizeId,
    conditionId: item.conditionId,
    colourIds: item.colourIds,
    priceMinor: priceMinorOf(item),
  };
}

const donePhotos = (item: UploadItem) => item.photos.filter((p) => p.state === "done" && p.key);

export function itemProblems(item: UploadItem, reference: ReferenceData): ItemProblems {
  const { values } = listingValuesOf(fieldsOf(item), donePhotos(item).length, reference);
  const fields = validateListing(values, reference, { publish: true });
  // A price that is typed but not a number counts as a missing price.
  if (item.priceText.trim() && priceMinorOf(item) === null)
    fields.priceMinor = "validation.listing.price.required";
  const uploading = item.photos.some((p) => p.state === "uploading");
  const failed = item.photos.some((p) => p.state === "failed");
  const photos = uploading ? "uploading" : failed ? "failed" : null;
  return { fields, photos, any: Object.keys(fields).length > 0 || photos !== null };
}

export const itemIsReady = (item: UploadItem, reference: ReferenceData) =>
  item.state !== "published" && item.state !== "publishing" && !itemProblems(item, reference).any;

/** The order the card names missing fields in. */
export const FIELD_ORDER: ListingField[] = [
  "photos",
  "title",
  "categoryId",
  "brandId",
  "sizeId",
  "conditionId",
  "colourIds",
  "priceMinor",
];

/** Names of what is missing, as keys of `adminUpload.fields`. */
export function missingFieldNames(problems: ItemProblems): string[] {
  const names = FIELD_ORDER.filter((f) => problems.fields[f]).map((f) => f as string);
  if (problems.photos && !names.includes("photos")) names.unshift("photos");
  return names;
}

/** One item as the server wants it. The item must be complete. */
export function toPublishItem(item: UploadItem, reference: ReferenceData): AdminListingItemInput {
  const photos = donePhotos(item).map((p) => ({ key: p.key as string, width: p.width, height: p.height }));
  return buildPublishItem(fieldsOf(item), photos, reference, { clientId: item.id });
}

/** Photos of an item that finished uploading, in order, for the AI to read. */
export const suggestionKeys = (item: UploadItem, max = 4) =>
  donePhotos(item)
    .map((p) => p.key as string)
    .slice(0, max);

/** A photo set that has finished going up and has not been read by the AI yet. */
export function wantsSuggestion(item: UploadItem): boolean {
  return (
    item.state === "draft" &&
    item.suggestion === "idle" &&
    item.photos.length > 0 &&
    item.photos.every((p) => p.state !== "uploading") &&
    item.photos.some((p) => p.state === "done")
  );
}

/** Fills only what is still empty. What it filled is marked as a suggestion until somebody edits it. */
export function applySuggestion(
  item: UploadItem,
  suggestion: PhotoSuggestion,
  reference: ReferenceData,
): UploadItem {
  const next: UploadItem = {
    ...item,
    suggestion:
      suggestion.categories.length > 0 || suggestion.brand || suggestion.colourIds.length > 0
        ? "done"
        : "none",
    suggested: { ...item.suggested },
  };
  const first = suggestion.categories[0];
  if (!item.categoryId && first && findCategory(reference.categories, first.id)?.isLeaf) {
    next.categoryId = first.id;
    next.suggested.category = true;
  }
  if (!item.brandId && !item.brandText.trim() && suggestion.brand) {
    next.brandId = suggestion.brand.id;
    next.brandText = suggestion.brand.name;
    next.suggested.brand = true;
  }
  if (item.colourIds.length === 0 && suggestion.colourIds.length > 0) {
    next.colourIds = suggestion.colourIds.slice(0, LISTING_COLOURS_MAX);
    next.suggested.colours = true;
  }
  return next;
}

/** Items that would be lost if the screen closed. */
export const unpostedCount = (items: UploadItem[]) => items.filter((i) => i.state !== "published").length;

// The reducer

export type UploadAction =
  | { type: "addToTray"; photos: UploadPhoto[] }
  | { type: "photo"; photoId: string; patch: Partial<UploadPhoto> }
  | { type: "toggleSelect"; photoId: string; max: number }
  | { type: "clearSelection" }
  | { type: "removeFromTray"; photoId: string }
  | { type: "makeItem"; itemId?: string }
  | { type: "removePhotoFromItem"; itemId: string; photoId: string }
  | { type: "deleteItem"; itemId: string }
  | { type: "edit"; itemId: string; patch: Partial<UploadItem>; reference: ReferenceData }
  | { type: "suggesting"; itemId: string }
  | { type: "suggested"; itemId: string; suggestion: PhotoSuggestion; reference: ReferenceData }
  | { type: "suggestFailed"; itemId: string }
  | { type: "publishing"; itemIds: string[] }
  | { type: "results"; result: AdminPublishResult }
  | { type: "publishFailed"; itemIds: string[]; message: string }
  | { type: "clearPosted" };

const patchItem = (items: UploadItem[], id: string, fn: (item: UploadItem) => UploadItem) =>
  items.map((i) => (i.id === id ? fn(i) : i));

/** Every photo, in the tray or in an item, with its place. */
export const allPhotos = (state: UploadState): UploadPhoto[] => [
  ...state.tray,
  ...state.items.flatMap((i) => i.photos),
];

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "addToTray":
      return { ...state, tray: [...state.tray, ...action.photos] };
    case "photo": {
      const patch = (p: UploadPhoto) => (p.id === action.photoId ? { ...p, ...action.patch } : p);
      return {
        ...state,
        tray: state.tray.map(patch),
        items: state.items.map((i) => ({ ...i, photos: i.photos.map(patch) })),
      };
    }
    case "toggleSelect": {
      if (!state.tray.some((p) => p.id === action.photoId)) return state;
      if (state.selected.includes(action.photoId))
        return { ...state, selected: state.selected.filter((id) => id !== action.photoId) };
      if (state.selected.length >= action.max) return state;
      return { ...state, selected: [...state.selected, action.photoId] };
    }
    case "clearSelection":
      return { ...state, selected: [] };
    case "removeFromTray":
      return {
        ...state,
        tray: state.tray.filter((p) => p.id !== action.photoId),
        selected: state.selected.filter((id) => id !== action.photoId),
      };
    case "makeItem": {
      // The selected photos move into a new item, in the order they were tapped.
      const chosen = state.selected
        .map((id) => state.tray.find((p) => p.id === id))
        .filter((p): p is UploadPhoto => Boolean(p));
      if (chosen.length === 0) return state;
      const item = { ...newItem(chosen), ...(action.itemId ? { id: action.itemId } : {}) };
      return {
        tray: state.tray.filter((p) => !state.selected.includes(p.id)),
        selected: [],
        items: [...state.items, item],
      };
    }
    case "removePhotoFromItem": {
      const item = state.items.find((i) => i.id === action.itemId);
      const photo = item?.photos.find((p) => p.id === action.photoId);
      if (!item || !photo || item.state === "publishing" || item.state === "published") return state;
      const remaining = item.photos.filter((p) => p.id !== action.photoId);
      return {
        ...state,
        tray: [...state.tray, photo],
        // An item with no photos left goes away.
        items:
          remaining.length === 0
            ? state.items.filter((i) => i.id !== item.id)
            : patchItem(state.items, item.id, (i) => ({ ...i, photos: remaining })),
      };
    }
    case "deleteItem": {
      const item = state.items.find((i) => i.id === action.itemId);
      if (!item) return state;
      // A posted item only disappears from the list, its photos belong to the listing now.
      const back = item.state === "published" ? [] : item.photos;
      return {
        ...state,
        tray: [...state.tray, ...back],
        items: state.items.filter((i) => i.id !== item.id),
      };
    }
    case "edit":
      return {
        ...state,
        items: patchItem(state.items, action.itemId, (item) => {
          const next: UploadItem = { ...item, ...action.patch, suggested: { ...item.suggested } };
          // Editing a field takes its suggestion mark away.
          if ("categoryId" in action.patch) next.suggested.category = false;
          if ("brandId" in action.patch || "brandText" in action.patch) next.suggested.brand = false;
          if ("colourIds" in action.patch) next.suggested.colours = false;
          // A new category can make the chosen size wrong.
          if ("categoryId" in action.patch && next.sizeId) {
            const category = next.categoryId
              ? findCategory(action.reference.categories, next.categoryId)
              : null;
            if (!sizeOptionsFor(action.reference, category).some((s) => s.id === next.sizeId))
              next.sizeId = null;
          }
          // Changing what failed clears the failure message, the next post decides again.
          if (item.state === "failed") {
            next.state = "draft";
            next.error = null;
            next.failedFields = null;
          }
          return next;
        }),
      };
    case "suggesting":
      return {
        ...state,
        items: patchItem(state.items, action.itemId, (i) => ({ ...i, suggestion: "loading" })),
      };
    case "suggested":
      return {
        ...state,
        items: patchItem(state.items, action.itemId, (i) =>
          applySuggestion(i, action.suggestion, action.reference),
        ),
      };
    case "suggestFailed":
      return {
        ...state,
        items: patchItem(state.items, action.itemId, (i) => ({ ...i, suggestion: "none" })),
      };
    case "publishing":
      return {
        ...state,
        items: state.items.map((i) =>
          action.itemIds.includes(i.id) ? { ...i, state: "publishing", error: null, failedFields: null } : i,
        ),
      };
    case "results": {
      const byId = new Map(action.result.results.map((x) => [x.clientId, x]));
      return {
        ...state,
        items: state.items.map((i) => {
          const res = byId.get(i.id);
          if (!res) return i;
          return res.ok
            ? { ...i, state: "published", listingId: res.listingId, error: null, failedFields: null }
            : { ...i, state: "failed", error: res.error, failedFields: res.fields };
        }),
      };
    }
    case "publishFailed":
      return {
        ...state,
        items: state.items.map((i) =>
          action.itemIds.includes(i.id) && i.state === "publishing"
            ? { ...i, state: "failed", error: action.message, failedFields: null }
            : i,
        ),
      };
    case "clearPosted":
      return { ...state, items: state.items.filter((i) => i.state !== "published") };
  }
}
