import { z } from "zod";
import { localeSchema } from "./common.js";

/** What a place suggestion is for: a city name (profile) or a street address (delivery addresses). */
export const PLACE_KINDS = ["city", "address"] as const;
export const placeKindSchema = z.enum(PLACE_KINDS);
export type PlaceKind = z.infer<typeof placeKindSchema>;

/** Fewest letters typed before the server is asked, so a single letter never costs a Google call. */
export const PLACE_QUERY_MIN = 3;
export const PLACE_QUERY_MAX = 100;

/** GET /v1/places/suggest */
export const placeSuggestQuerySchema = z.object({
  q: z.string().trim().min(PLACE_QUERY_MIN).max(PLACE_QUERY_MAX),
  kind: placeKindSchema,
  language: localeSchema.optional(),
});
export type PlaceSuggestQuery = z.infer<typeof placeSuggestQuerySchema>;

/** One line of the suggestion list: the main words and a quieter second line (city, country). */
export const placeSuggestionSchema = z.object({
  id: z.string().min(1).max(300),
  main: z.string(),
  secondary: z.string(),
});
export type PlaceSuggestion = z.infer<typeof placeSuggestionSchema>;

/** Always 200. Empty when the key is not set, the person typed too little or Google did not answer. */
export const placeSuggestionsSchema = z.object({ suggestions: z.array(placeSuggestionSchema).max(8) });
export type PlaceSuggestions = z.infer<typeof placeSuggestionsSchema>;

/** GET /v1/places/:id, the address parts of the chosen suggestion. Every part can be empty. */
export const placeDetailsSchema = z.object({
  line1: z.string(),
  city: z.string(),
  postcode: z.string(),
});
export type PlaceDetails = z.infer<typeof placeDetailsSchema>;
export const EMPTY_PLACE_DETAILS: PlaceDetails = { line1: "", city: "", postcode: "" };
