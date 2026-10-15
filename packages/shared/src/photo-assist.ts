import { z } from "zod";
import { idSchema, localeSchema } from "./common.js";
import { LISTING_COLOURS_MAX, LISTING_DESCRIPTION_MAX, LISTING_TITLE_MAX } from "./listing-rules.js";

/** How many of the seller's photos the helper reads. The first ones, so the cover comes first. */
export const PHOTO_ASSIST_MAX_PHOTOS = 4;

/**
 * GET /v1/sell/assist: whether the helpers are on (a Claude key is set and the AI switch is on). `textAssist` is new
 * in D-036, older servers do not send it, so it is optional and missing means off.
 */
export const photoAssistStatusSchema = z.object({
  photoAssist: z.boolean(),
  textAssist: z.boolean().optional(),
  /** Search in plain words (D-037). Missing means off. */
  searchAssist: z.boolean().optional(),
  /** Chat quick replies and warnings (D-041). Missing means off. */
  chatAssist: z.boolean().optional(),
});
export type PhotoAssistStatus = z.infer<typeof photoAssistStatusSchema>;

/** POST /v1/listings/suggest: the keys of photos the seller already uploaded, and the app language for the words. */
export const suggestRequestSchema = z.object({
  photoKeys: z.array(z.string().min(1).max(300)).min(1).max(PHOTO_ASSIST_MAX_PHOTOS),
  language: localeSchema,
});
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

const confidenceSchema = z.number().min(0).max(1);

// ---- Photo tips (D-036): a gentle, dismissible tip, never a block. ----

/** What a photo tip can be about, the most important first (the app shows that order). */
export const PHOTO_TIP_KINDS = ["contact", "cut_off", "dark"] as const;
export type PhotoTipKind = (typeof PHOTO_TIP_KINDS)[number];

/** One photo with a problem: its upload key (so reordering photos keeps the tip on the right one) and what is wrong. */
export const photoTipSchema = z.object({
  key: z.string().min(1).max(300),
  kinds: z.array(z.enum(PHOTO_TIP_KINDS)).min(1).max(PHOTO_TIP_KINDS.length),
});
export type PhotoTip = z.infer<typeof photoTipSchema>;
export const photoTipsSchema = z.array(photoTipSchema).max(PHOTO_ASSIST_MAX_PHOTOS);

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
  /** Gentle tips about the photos that were read (D-036). Only photos with a problem are listed. */
  photoTips: photoTipsSchema,
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
  photoTips: [],
};

/** A suggestion that is worth showing: at least one field is filled. */
export function photoSuggestionHasContent(s: PhotoSuggestion): boolean {
  return Boolean(s.categories.length > 0 || s.brand || s.colourIds.length > 0);
}

/** POST /v1/listings/photo-check: photos added after the first read, checked for tips only. */
export const photoCheckRequestSchema = z.object({
  photoKeys: z.array(z.string().min(1).max(300)).min(1).max(PHOTO_ASSIST_MAX_PHOTOS),
});
export const photoCheckSchema = z.object({ photoTips: photoTipsSchema });
export type PhotoCheck = z.infer<typeof photoCheckSchema>;

// ---- Text suggestions (D-036): guesses from the title and description the seller typed. ----

/** The title and description together must have at least this many letters before they are worth reading. */
export const TEXT_ASSIST_MIN_CHARS = 3;

/** POST /v1/listings/suggest-text */
export const textSuggestRequestSchema = z
  .object({
    title: z.string().max(LISTING_TITLE_MAX),
    description: z.string().max(LISTING_DESCRIPTION_MAX).default(""),
    language: localeSchema,
  })
  .refine((v) => `${v.title}${v.description}`.trim().length >= TEXT_ASSIST_MIN_CHARS, {
    message: "Too little text to read",
  });
export type TextSuggestRequest = z.input<typeof textSuggestRequestSchema>;

/** What the words suggest. Same shapes as the photo suggestion, plus the condition, which words can tell. */
export const textSuggestionSchema = z.object({
  categories: z
    .array(z.object({ id: idSchema, confidence: confidenceSchema }))
    .max(PHOTO_ASSIST_MAX_CATEGORIES),
  /** A brand named in the text. `id` is set when it matched a brand we know. */
  brand: z.object({ id: idSchema.nullable(), name: z.string().min(1).max(80) }).nullable(),
  conditionId: idSchema.nullable(),
  colourIds: z.array(idSchema).max(LISTING_COLOURS_MAX),
});
export type TextSuggestion = z.infer<typeof textSuggestionSchema>;

export const EMPTY_TEXT_SUGGESTION: TextSuggestion = {
  categories: [],
  brand: null,
  conditionId: null,
  colourIds: [],
};

/** The guesses the sell form shows: photos and words together. */
export type SellGuesses = PhotoSuggestion & {
  conditionId: string | null;
  /** Where the brand guess came from, so the label can say "From the tag" or "Looks like". */
  brandSource: "tag" | "text" | null;
};

/**
 * Puts the photo and text guesses together (D-036). Words win for category, brand and condition (a seller who typed
 * "Nike sneakers" knows), photos win for colours. A category both agree on goes first. Null when there is neither.
 */
export function mergeGuesses(photo: PhotoSuggestion | null, text: TextSuggestion | null): SellGuesses | null {
  if (!photo && !text) return null;
  const base = photo ?? EMPTY_PHOTO_SUGGESTION;
  const textCats = text?.categories ?? [];
  const both = textCats.filter((c) => base.categories.some((p) => p.id === c.id));
  const categories: PhotoSuggestion["categories"] = [];
  for (const c of [...both, ...textCats, ...base.categories]) {
    if (!categories.some((x) => x.id === c.id)) categories.push(c);
    if (categories.length >= PHOTO_ASSIST_MAX_CATEGORIES) break;
  }
  const brand = text?.brand ?? base.brand;
  return {
    ...base,
    categories,
    brand,
    brandSource: text?.brand ? "text" : base.brand ? "tag" : null,
    colourIds: base.colourIds.length > 0 ? base.colourIds : (text?.colourIds ?? []),
    conditionId: text?.conditionId ?? null,
  };
}
