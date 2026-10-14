import { z } from "zod";
import { idSchema, localeSchema } from "./common.js";
import { LISTING_SORTS } from "./enums.js";
import type { SearchFilters } from "./listings.js";
import { minorUnitsSchema } from "./money.js";

/**
 * Search in plain words (D-037): a sentence such as "red summer dress under 100" is turned into our normal filters by
 * Claude Haiku, and the filters switch on with an easy way back to the exact words. Short searches never go to the AI.
 */

/** A search goes to the AI only with at least this many words, or with a number in it. */
export const SEARCH_ASSIST_MIN_WORDS = 3;

/** True when the words are worth turning into filters. "Zara" or "linen shirt" stay a plain word search. */
export function searchNeedsUnderstanding(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.length >= SEARCH_ASSIST_MIN_WORDS || /\p{Nd}/u.test(text);
}

/** POST /v1/search/understand */
export const searchUnderstandRequestSchema = z.object({
  text: z.string().trim().min(1).max(100),
  language: localeSchema,
});
export type SearchUnderstandRequest = z.infer<typeof searchUnderstandRequestSchema>;

/**
 * What the words mean as filters. Every id was checked against our own lists on the server. `q` is the words left
 * over that are worth matching as text (a model name such as "air force 1"), often empty. `understood` is false when
 * no filter came out: the app then simply searches the exact words.
 */
export const searchUnderstandingSchema = z.object({
  understood: z.boolean(),
  q: z.string().max(100),
  /** One category, a leaf or a whole group ("Dresses" covers every kind of dress). */
  categoryId: idSchema.nullable(),
  brandIds: z.array(idSchema).max(5),
  sizeIds: z.array(idSchema).max(10),
  colourIds: z.array(idSchema).max(5),
  conditionIds: z.array(idSchema).max(5),
  materialIds: z.array(idSchema).max(3),
  patternIds: z.array(idSchema).max(3),
  priceMinMinor: minorUnitsSchema.nullable(),
  priceMaxMinor: minorUnitsSchema.nullable(),
  /** Only when the words ask for an order ("cheapest", "newest"). */
  sort: z.enum(LISTING_SORTS).nullable(),
});
export type SearchUnderstanding = z.infer<typeof searchUnderstandingSchema>;

export const EMPTY_SEARCH_UNDERSTANDING: SearchUnderstanding = {
  understood: false,
  q: "",
  categoryId: null,
  brandIds: [],
  sizeIds: [],
  colourIds: [],
  conditionIds: [],
  materialIds: [],
  patternIds: [],
  priceMinMinor: null,
  priceMaxMinor: null,
  sort: null,
};

/**
 * The understanding as search filters, over the filters already chosen: a kind the words name replaces what was there,
 * the rest stays. `q` becomes the left over words.
 */
export function applyUnderstanding(
  current: Partial<SearchFilters>,
  u: SearchUnderstanding,
): Partial<SearchFilters> {
  const next: Partial<SearchFilters> = { ...current, q: u.q || undefined };
  if (u.categoryId) {
    next.categoryId = u.categoryId;
    next.categoryIds = undefined;
  }
  if (u.brandIds.length > 0) next.brandIds = u.brandIds;
  if (u.sizeIds.length > 0) next.sizeIds = u.sizeIds;
  if (u.colourIds.length > 0) next.colourIds = u.colourIds;
  if (u.conditionIds.length > 0) next.conditionIds = u.conditionIds;
  if (u.materialIds.length > 0) next.materialIds = u.materialIds;
  if (u.patternIds.length > 0) next.patternIds = u.patternIds;
  if (u.priceMinMinor !== null) next.priceMinMinor = u.priceMinMinor;
  if (u.priceMaxMinor !== null) next.priceMaxMinor = u.priceMaxMinor;
  if (u.sort) next.sort = u.sort;
  return next;
}
