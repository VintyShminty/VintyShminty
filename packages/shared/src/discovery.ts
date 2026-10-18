import { z } from "zod";
import { COVER_SIDES } from "./browse-tiles.js";
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
  categoryIds: idList(40),
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

/**
 * GET /v1/browse/covers?side=women. The cover photos of the newest listings under every tile of one side, in one call
 * instead of one per tile (each call can start a server copy). `covers` maps a tile key to up to six photo addresses.
 */
export const browseCoversQuerySchema = z.object({ side: z.enum(COVER_SIDES).default("all") });
export const browseCoversSchema = z.object({ covers: z.record(z.string(), z.array(z.string())) });
export type BrowseCovers = z.infer<typeof browseCoversSchema>;

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

/** The mood chips on Home. `for_you` is the normal personalised feed. */
export const FEED_MOODS = ["for_you", "new_today", "under_50", "your_sizes", "near_you"] as const;
export type FeedMood = (typeof FEED_MOODS)[number];
/** Under 50 means below 5000 minor units (50.00) in the default currency. */
export const UNDER_50_MINOR = 5000;

/** The Men and Women pills on the website's Home. They narrow the feed to that top category. */
export const FEED_GROUPS = ["women", "men"] as const;
export type FeedGroup = (typeof FEED_GROUPS)[number];

/** GET /v1/feed. A mood chip passes `mood`, a category passes `categoryId`, Men or Women passes `group`, Trending passes `trending=true`. */
export const feedQuerySchema = paginationQuerySchema.extend({
  mood: z.enum(FEED_MOODS).optional(),
  group: z.enum(FEED_GROUPS).optional(),
  categoryId: idSchema.optional(),
  /** The Price chip: item price from and to, inclusive, in minor units. Swapped when from is above to. */
  priceMinMinor: queryMinor,
  priceMaxMinor: queryMinor,
  trending: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Why a card is in the home feed. The app turns `kind` plus `name` into a sentence in the person's language. */
export const FEED_REASON_KINDS = [
  "follows_seller",
  "like_seller",
  "like_brand",
  "like_category",
  "matches_size",
  "new_in_category",
  "new",
  "popular",
  "price_drop",
  "explore",
] as const;
export type FeedReasonKind = (typeof FEED_REASON_KINDS)[number];
export const feedReasonSchema = z.object({
  kind: z.enum(FEED_REASON_KINDS),
  /** The seller's username, the brand name or the category name. Null when the sentence has no name. */
  name: localisedNameSchema.nullable(),
});
export type FeedReason = z.infer<typeof feedReasonSchema>;

/** A card on the home feed. `reason` is null when nothing in particular put it there. */
export const feedCardSchema = listingCardSchema.extend({ reason: feedReasonSchema.nullable() });
export type FeedCard = z.infer<typeof feedCardSchema>;

/**
 * GET /v1/feed. `feedId` names the saved list the page came from (null for Trending). The app sends it back with each
 * card seen, so the server knows what was shown.
 */
export const homeFeedPageSchema = pageSchema(feedCardSchema).extend({ feedId: idSchema.nullable() });
export type HomeFeedPage = z.infer<typeof homeFeedPageSchema>;

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
