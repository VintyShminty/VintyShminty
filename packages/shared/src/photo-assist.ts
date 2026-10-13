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

/**
 * What the helper thinks the photos show. Every id here was checked against our own lists on the server, so the app can
 * use them as they are. A field it could not tell is null (or empty). Confidence is 0 to 1.
 */
export const photoSuggestionSchema = z.object({
  categoryId: idSchema.nullable(),
  /** The brand read from a tag. `id` is set when it matched a brand we know, otherwise only the text is given. */
  brand: z.object({ id: idSchema.nullable(), name: z.string().min(1).max(80) }).nullable(),
  colourIds: z.array(idSchema).max(LISTING_COLOURS_MAX),
  materialId: idSchema.nullable(),
  title: z.string().max(LISTING_TITLE_MAX).nullable(),
  description: z.string().max(LISTING_DESCRIPTION_MAX).nullable(),
  confidence: z.object({
    category: confidenceSchema,
    brand: confidenceSchema,
    colours: confidenceSchema,
    material: confidenceSchema,
  }),
});
export type PhotoSuggestion = z.infer<typeof photoSuggestionSchema>;

/** What comes back when the helper is off, fails or sees nothing useful. */
export const EMPTY_PHOTO_SUGGESTION: PhotoSuggestion = {
  categoryId: null,
  brand: null,
  colourIds: [],
  materialId: null,
  title: null,
  description: null,
  confidence: { category: 0, brand: 0, colours: 0, material: 0 },
};

/** A suggestion that is worth showing: at least one field is filled. */
export function photoSuggestionHasContent(s: PhotoSuggestion): boolean {
  return Boolean(
    s.categoryId || s.brand?.id || s.colourIds.length > 0 || s.materialId || s.title || s.description,
  );
}

/** The app only fills in a field when the helper is at least this sure of it. */
export const PHOTO_ASSIST_MIN_CONFIDENCE = 0.6;
