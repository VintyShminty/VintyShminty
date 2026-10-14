import { z } from "zod";
import { idSchema, localeSchema } from "./common.js";
import { LISTING_COLOURS_MAX, LISTING_DESCRIPTION_MAX, LISTING_TITLE_MAX } from "./listing-rules.js";

/** How many of the seller's photos the helper reads. The first ones, so the cover comes first. */
export const PHOTO_ASSIST_MAX_PHOTOS = 4;

/** GET /v1/sell/assist: whether the server has the photo helper switched on. */
export const photoAssistStatusSchema = z.object({ photoAssist: z.boolean() });
export type PhotoAssistStatus = z.infer<typeof photoAssistStatusSchema>;

/** POST /v1/listings/suggest: the keys of photos the seller already uploaded, and the app language for the words. */
export const suggestRequestSchema = z.object({
  photoKeys: z.array(z.string().min(1).max(300)).min(1).max(PHOTO_ASSIST_MAX_PHOTOS),
  language: localeSchema,
});
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

const confidenceSchema = z.number().min(0).max(1);

/** How many category guesses the helper gives, best first. */
export const PHOTO_ASSIST_MAX_CATEGORIES = 3;

/**
 * What the helper thinks the photos show (D-028). It never fills a field. The app shows these first inside the pickers
 * the seller goes through anyway. Every id here was checked against our own lists on the server. A field it could not
 * tell is null (or empty).
 *
 * The helper only guesses category, colours and brand. `materialId`, `title` and `description` are no longer guessed:
 * the server always sends null. They stay in the schema because TestFlight build 3 requires the keys when it parses the
 * answer (remove them only once no build older than the one that stopped reading them is in use).
 */
export const photoSuggestionSchema = z.object({
  /** Up to 3 leaf categories, the most likely first. */
  categories: z
    .array(z.object({ id: idSchema, confidence: confidenceSchema }))
    .max(PHOTO_ASSIST_MAX_CATEGORIES),
  /** The brand read from a tag. `id` is set when it matched a brand we know, otherwise only the text is given. */
  brand: z.object({ id: idSchema.nullable(), name: z.string().min(1).max(80) }).nullable(),
  colourIds: z.array(idSchema).max(LISTING_COLOURS_MAX),
  /** Retired, always null. Kept so older app builds can still parse the answer. */
  materialId: idSchema.nullable(),
  /** Retired, always null. */
  title: z.string().max(LISTING_TITLE_MAX).nullable(),
  /** Retired, always null. */
  description: z.string().max(LISTING_DESCRIPTION_MAX).nullable(),
});
export type PhotoSuggestion = z.infer<typeof photoSuggestionSchema>;

/** What comes back when the helper is off, fails or sees nothing useful. */
export const EMPTY_PHOTO_SUGGESTION: PhotoSuggestion = {
  categories: [],
  brand: null,
  colourIds: [],
  materialId: null,
  title: null,
  description: null,
};

/** A suggestion that is worth showing: at least one field is filled. */
export function photoSuggestionHasContent(s: PhotoSuggestion): boolean {
  return Boolean(s.categories.length > 0 || s.brand || s.colourIds.length > 0);
}
