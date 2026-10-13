import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  localisedNameSchema,
  pageSchema,
  paginationQuerySchema,
} from "./common.js";
import { REPORT_REASONS, REPORT_TARGETS } from "./enums.js";
import { listingCardSchema, searchFiltersSchema } from "./listings.js";
import { userSummarySchema } from "./users.js";

/**
 * A list of ids in a query string. The app may send `brandIds=a,b` or repeat the key (`brandIds=a&brandIds=b`),
 * both end up as an array.
 */
const idList = (max: number) =>
  z
    .preprocess(
      (value) => (typeof value === "string" ? (value === "" ? [] : value.split(",")) : value),
      z.array(idSchema).max(max),
    )
    .optional();

const queryMinor = z.coerce.number().int().min(0).max(2_000_000_000).optional();

/** The filters as they travel in a query string (GET /v1/listings, /v1/listings/count). */
export const searchFiltersQuerySchema = searchFiltersSchema.extend({
  brandIds: idList(20),
  sizeIds: idList(30),
  conditionIds: idList(5),
  colourIds: idList(10),
  materialIds: idList(10),
  patternIds: idList(10),
  priceMinMinor: queryMinor,
  priceMaxMinor: queryMinor,
});

/** GET /v1/listings. Filters plus the page query. */
export const searchQuerySchema = searchFiltersQuerySchema.extend(paginationQuerySchema.shape);
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Search answers carry the number of matches, counted up to 500. */
export const SEARCH_TOTAL_CAP = 500;
export const searchPageSchema = pageSchema(listingCardSchema).extend({
  total: z.number().int().min(0),
  /** True when there are more than 500 matches. `total` is then 500 and the app shows "500+". */
  totalCapped: z.boolean(),
});
export type SearchPage = z.infer<typeof searchPageSchema>;

export const searchCountSchema = searchPageSchema.pick({ total: true, totalCapped: true });
export type SearchCount = z.infer<typeof searchCountSchema>;

/** GET /v1/feed. A category chip passes `categoryId`, the Trending chip passes `trending=true`. */
export const feedQuerySchema = paginationQuerySchema.extend({
  categoryId: idSchema.optional(),
  trending: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Cards in the feed, search, similar and favourites carry `seller` (see `listingCardSchema`). */
export const feedPageSchema = pageSchema(listingCardSchema);

/** GET /v1/listings/:id/similar and /v1/me/favourites reuse the page query. */
export const favouritesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});

/** GET /v1/users/:id/listings. The Filter link on the profile uses the same filters, minus the seller. */
export const userListingsQuerySchema = searchFiltersQuerySchema
  .omit({ sellerId: true })
  .extend(paginationQuerySchema.shape)
  .extend({ status: z.enum(["active", "sold"]).default("active") });
export type UserListingsQuery = z.infer<typeof userListingsQuerySchema>;

/** GET /v1/search/suggestions */
export const suggestionsQuerySchema = z.object({ q: z.string().trim().min(1).max(100) });
export const SUGGESTION_KINDS = ["query", "brand", "category"] as const;
export const suggestionSchema = z.object({
  /** What to put in the search field, in the language the person typed. */
  text: z.string(),
  kind: z.enum(SUGGESTION_KINDS),
  categoryId: idSchema.optional(),
  categoryName: localisedNameSchema.optional(),
  brandId: idSchema.optional(),
});
export const suggestionsSchema = z.object({ suggestions: z.array(suggestionSchema).max(10) });
export type Suggestion = z.infer<typeof suggestionSchema>;

/** GET /v1/users?q= (the Members tab). Prefix match on the username. */
export const membersQuerySchema = paginationQuerySchema.extend({ q: z.string().trim().min(1).max(40) });
export const membersPageSchema = pageSchema(userSummarySchema);

/** PUT and DELETE /v1/listings/:id/favourite */
export const favouriteResultSchema = z.object({ favouriteCount: z.number().int().min(0) });

export const SAVED_SEARCH_MAX = 50;
export const savedSearchSchema = z.object({
  id: idSchema,
  queryText: z.string().nullable(),
  filters: searchFiltersSchema,
  notifyOnNew: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type SavedSearch = z.infer<typeof savedSearchSchema>;
export const savedSearchListSchema = z.object({ items: z.array(savedSearchSchema) });
export const createSavedSearchInputSchema = z.object({
  queryText: z.string().trim().max(100).optional(),
  filters: searchFiltersSchema.default({ sort: "relevance" }),
  notifyOnNew: z.boolean().default(true),
});
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchInputSchema>;
export const updateSavedSearchInputSchema = z.object({ notifyOnNew: z.boolean() });

export const RECENT_SEARCHES_MAX = 10;
export const recentSearchSchema = z.object({
  id: idSchema,
  queryText: z.string(),
  filters: searchFiltersSchema,
  resultCount: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
});
export type RecentSearch = z.infer<typeof recentSearchSchema>;
export const recentSearchListSchema = z.object({ items: z.array(recentSearchSchema) });
export const createRecentSearchInputSchema = z.object({
  queryText: z.string().trim().min(1).max(100),
  filters: searchFiltersSchema.default({ sort: "relevance" }),
  resultCount: z.number().int().min(0).max(100_000).optional(),
});

/** POST /v1/reports */
export const createReportInputSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: idSchema,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportInputSchema>;

/** PUT /v1/me/personalisation/sizes */
export const PERSONALISATION_SIZES_MAX = 60;
export const personalisationSizesSchema = z.object({
  sizeIds: z.array(idSchema).max(PERSONALISATION_SIZES_MAX),
});
export type PersonalisationSizes = z.infer<typeof personalisationSizesSchema>;
