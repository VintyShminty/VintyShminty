import {
  type AdminListingItemInput,
  type AdminPublishResult,
  buildPublishItem,
  findCategory,
  LISTING_COLOURS_MAX,
  type ListingField,
  type ListingFieldErrors,
  listingLimits,
  listingValuesOf,
  OWNER_NAME_MIN,
  type PhotoSuggestion,
  type ReferenceData,
  sizeOptionsFor,
  splitIntoGroups,
  type UploadItemFields,
  validateListing,
} from "@vinty/shared";
import { parseMinor } from "./admin-format";

// The reading and grouping helpers live in the shared package so the phone app uses the same ones.
export {
  type LeafOption,
  leafOptions,
  parcelSizeFor,
  searchLeaves,
  sizeOptionsFor,
  splitIntoGroups,
} from "@vinty/shared";

/** Splits a list into batches of at most `size`. */
export const chunk = splitIntoGroups;

/**
 * The listing upload table, without any screen in it: what a row holds, what makes it complete (the same shared
 * listing rules the app and the server use), what is sent to the server, and how rows change. Tested on its own.
 */

export type UploadPhoto = {
  id: string;
  name: string;
  /** A picture of the file on this computer, shown while it uploads. */
  previewUrl: string;
  status: "uploading" | "done" | "error";
  /** 0 to 1. */
  progress: number;
  key?: string;
  width?: number;
  height?: number;
  error?: string;
};

export type SuggestionState = "idle" | "loading" | "done" | "none";

export type UploadRow = {
  id: string;
  photos: UploadPhoto[];
  title: string;
  description: string;
  categoryId: string | null;
  brandId: string | null;
  /** The brand as written. Equals the listed brand's name when `brandId` is set, else it is the typed brand. */
  brandText: string;
  sizeId: string | null;
  conditionId: string | null;
  colourIds: string[];
  /** The price as typed, in shekels. */
  priceText: string;
  ownerOverride: string;
  suggestion: {
    state: SuggestionState;
    /** The other guesses, best first, for one click choices next to the category. */
    categories: { id: string; confidence: number }[];
  };
  /** Fields the AI filled in that nobody edited yet. They are shown as suggestions. */
  suggested: { category: boolean; brand: boolean; colours: boolean };
  state: "draft" | "publishing" | "failed" | "published";
  error: string | null;
  failedFields: Record<string, string> | null;
  listingId: string | null;
};

let counter = 0;
/** A short id that is unique in this page. */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function newRow(photos: UploadPhoto[]): UploadRow {
  return {
    id: newId("row"),
    photos,
    title: "",
    description: "",
    categoryId: null,
    brandId: null,
    brandText: "",
    sizeId: null,
    conditionId: null,
    colourIds: [],
    priceText: "",
    ownerOverride: "",
    suggestion: { state: "idle", categories: [] },
    suggested: { category: false, brand: false, colours: false },
    state: "draft",
    error: null,
    failedFields: null,
    listingId: null,
  };
}

// Reading the reference data

// Is a row complete

export type RowProblems = {
  /** Field name (as the listing rules name them) to its translation key, from the shared rules. */
  fields: ListingFieldErrors;
  /** Photos still going up, or failed. */
  photos: "uploading" | "failed" | "none" | null;
  owner: boolean;
  /** Any problem at all. */
  any: boolean;
};

export function priceMinorOf(row: Pick<UploadRow, "priceText">): number | null {
  return parseMinor(row.priceText);
}

/** The values the listing rules look at, with rows the category hides cleared (as the server does). */
function valuesOf(row: UploadRow, reference: ReferenceData) {
  return listingValuesOf(fieldsOf(row), row.photos.filter((p) => p.status === "done").length, reference);
}

function fieldsOf(row: UploadRow): UploadItemFields {
  return {
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    brandId: row.brandId,
    brandText: row.brandText,
    sizeId: row.sizeId,
    conditionId: row.conditionId,
    colourIds: row.colourIds,
    priceMinor: priceMinorOf(row),
  };
}

export function rowProblems(row: UploadRow, reference: ReferenceData): RowProblems {
  const { values } = valuesOf(row, reference);
  const fields = validateListing(values, reference, { publish: true });
  // A price that is typed but not a number counts as a missing price.
  if (row.priceText.trim() && priceMinorOf(row) === null)
    fields.priceMinor = "validation.listing.price.required";
  const uploading = row.photos.some((p) => p.status === "uploading");
  const failed = row.photos.some((p) => p.status === "error");
  const photos = uploading ? "uploading" : failed ? "failed" : row.photos.length === 0 ? "none" : null;
  const override = row.ownerOverride.trim();
  const owner = override.length > 0 && override.length < OWNER_NAME_MIN;
  return { fields, photos, owner, any: Object.keys(fields).length > 0 || photos !== null || owner };
}

export const rowIsReady = (row: UploadRow, reference: ReferenceData) =>
  row.state !== "published" && row.state !== "publishing" && !rowProblems(row, reference).any;

/** Which fields are missing, in the order the table shows them, as names for `admin.upload.fields.<name>`. */
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

export function missingFieldNames(problems: RowProblems): string[] {
  const names = FIELD_ORDER.filter((f) => problems.fields[f]).map((f) => f as string);
  if (problems.photos && !names.includes("photos")) names.unshift("photos");
  return names;
}

// What is sent

/** One row as the server wants it. The row must be complete. */
export function toPublishItem(row: UploadRow, reference: ReferenceData): AdminListingItemInput {
  const photos = row.photos.flatMap((p) =>
    p.status === "done" && p.key && p.width && p.height
      ? [{ key: p.key, width: p.width, height: p.height }]
      : [],
  );
  return buildPublishItem(fieldsOf(row), photos, reference, {
    clientId: row.id,
    ...(row.ownerOverride.trim() ? { ownerFullName: row.ownerOverride.trim() } : {}),
  });
}

/** Only the pictures from a drop or a file picker. */
export function imageFilesOf(files: Iterable<File>): File[] {
  return [...files].filter(
    (f) => /^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name),
  );
}

/** The room left in a row for more photos. */
export const photoRoom = (row: UploadRow, reference: ReferenceData) =>
  Math.max(0, listingLimits(reference).maxPhotos - row.photos.length);

// Applying the AI suggestion

/** Fills only what is still empty. What it filled is marked as a suggestion until somebody edits it. */
export function applySuggestion(
  row: UploadRow,
  suggestion: PhotoSuggestion,
  reference: ReferenceData,
): UploadRow {
  const next: UploadRow = {
    ...row,
    suggestion: {
      state:
        suggestion.categories.length > 0 || suggestion.brand || suggestion.colourIds.length > 0
          ? "done"
          : "none",
      categories: suggestion.categories,
    },
    suggested: { ...row.suggested },
  };
  const first = suggestion.categories[0];
  if (!row.categoryId && first && findCategory(reference.categories, first.id)?.isLeaf) {
    next.categoryId = first.id;
    next.suggested.category = true;
  }
  if (!row.brandId && !row.brandText.trim() && suggestion.brand) {
    next.brandId = suggestion.brand.id;
    next.brandText = suggestion.brand.name;
    next.suggested.brand = true;
  }
  if (row.colourIds.length === 0 && suggestion.colourIds.length > 0) {
    next.colourIds = suggestion.colourIds.slice(0, LISTING_COLOURS_MAX);
    next.suggested.colours = true;
  }
  return next;
}

/** A photo set that has finished going up and has not been read by the AI yet. */
export function wantsSuggestion(row: UploadRow): boolean {
  return (
    row.state === "draft" &&
    row.suggestion.state === "idle" &&
    row.photos.length > 0 &&
    row.photos.every((p) => p.status !== "uploading") &&
    row.photos.some((p) => p.status === "done")
  );
}

// The rows, as a reducer

export type UploadAction =
  | { type: "addRows"; rows: UploadRow[] }
  | { type: "addPhotos"; rowId: string; photos: UploadPhoto[] }
  | { type: "photo"; rowId: string; photoId: string; patch: Partial<UploadPhoto> }
  | { type: "removePhoto"; rowId: string; photoId: string }
  | { type: "removeRow"; rowId: string }
  | { type: "edit"; rowId: string; patch: Partial<UploadRow>; reference: ReferenceData }
  | { type: "suggesting"; rowId: string }
  | { type: "suggested"; rowId: string; suggestion: PhotoSuggestion; reference: ReferenceData }
  | { type: "suggestFailed"; rowId: string }
  | { type: "publishing"; rowIds: string[] }
  | { type: "results"; result: AdminPublishResult }
  | { type: "publishFailed"; rowIds: string[]; message: string }
  | { type: "clearPublished" };

const patchRow = (rows: UploadRow[], id: string, fn: (row: UploadRow) => UploadRow) =>
  rows.map((r) => (r.id === id ? fn(r) : r));

export function uploadReducer(rows: UploadRow[], action: UploadAction): UploadRow[] {
  switch (action.type) {
    case "addRows":
      return [...rows, ...action.rows];
    case "addPhotos":
      return patchRow(rows, action.rowId, (r) => ({ ...r, photos: [...r.photos, ...action.photos] }));
    case "photo":
      return patchRow(rows, action.rowId, (r) => ({
        ...r,
        photos: r.photos.map((p) => (p.id === action.photoId ? { ...p, ...action.patch } : p)),
      }));
    case "removePhoto":
      return rows
        .map((r) =>
          r.id === action.rowId ? { ...r, photos: r.photos.filter((p) => p.id !== action.photoId) } : r,
        )
        .filter((r) => r.photos.length > 0 || r.id !== action.rowId);
    case "removeRow":
      return rows.filter((r) => r.id !== action.rowId);
    case "edit":
      return patchRow(rows, action.rowId, (r) => {
        const next: UploadRow = { ...r, ...action.patch, suggested: { ...r.suggested } };
        // Editing a field takes its suggestion mark away.
        if ("categoryId" in action.patch) next.suggested.category = false;
        if ("brandId" in action.patch || "brandText" in action.patch) next.suggested.brand = false;
        if ("colourIds" in action.patch) next.suggested.colours = false;
        // A new category can make the chosen size wrong.
        if ("categoryId" in action.patch) {
          const category = next.categoryId
            ? findCategory(action.reference.categories, next.categoryId)
            : null;
          if (next.sizeId && !sizeOptionsFor(action.reference, category).some((s) => s.id === next.sizeId)) {
            next.sizeId = null;
          }
        }
        // Changing what failed clears the failure message, the next publish decides again.
        if (r.state === "failed") {
          next.state = "draft";
          next.error = null;
          next.failedFields = null;
        }
        return next;
      });
    case "suggesting":
      return patchRow(rows, action.rowId, (r) => ({
        ...r,
        suggestion: { ...r.suggestion, state: "loading" },
      }));
    case "suggested":
      return patchRow(rows, action.rowId, (r) => applySuggestion(r, action.suggestion, action.reference));
    case "suggestFailed":
      return patchRow(rows, action.rowId, (r) => ({ ...r, suggestion: { state: "none", categories: [] } }));
    case "publishing":
      return rows.map((r) => (action.rowIds.includes(r.id) ? { ...r, state: "publishing", error: null } : r));
    case "results": {
      const byId = new Map(action.result.results.map((x) => [x.clientId, x]));
      return rows.map((r) => {
        const res = byId.get(r.id);
        if (!res) return r;
        return res.ok
          ? { ...r, state: "published", listingId: res.listingId, error: null, failedFields: null }
          : { ...r, state: "failed", error: res.error, failedFields: res.fields };
      });
    }
    case "publishFailed":
      return rows.map((r) =>
        action.rowIds.includes(r.id) && r.state === "publishing"
          ? { ...r, state: "failed", error: action.message, failedFields: null }
          : r,
      );
    case "clearPublished":
      return rows.filter((r) => r.state !== "published");
  }
}

/** Rows that would be lost if the page closed. */
export const unpublishedCount = (rows: UploadRow[]) => rows.filter((r) => r.state !== "published").length;

/** The file name from a Content-Disposition header, or a fallback. */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}
