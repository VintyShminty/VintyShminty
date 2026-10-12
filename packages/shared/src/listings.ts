import { z } from "zod";
import { idSchema, isoDateTimeSchema, pageSchema, paginationQuerySchema, photoSchema } from "./common.js";
import { LISTING_SORTS, LISTING_STATUSES } from "./enums.js";
import { minorUnitsSchema } from "./money.js";
import { userSummarySchema } from "./users.js";

export const listingTitleSchema = z.string().trim().min(3).max(80);
export const listingDescriptionSchema = z.string().trim().max(2000);

/** A photo the app already uploaded to storage. Position 0 is the cover. */
export const listingPhotoInputSchema = z.object({
  key: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.string().default("image/jpeg"),
  byteSize: z.number().int().positive().optional(),
  placeholder: z.string().max(200).optional(),
});

/** Fields shared by drafts and published listings. A draft may be incomplete. */
export const listingDraftInputSchema = z.object({
  title: listingTitleSchema.optional(),
  description: listingDescriptionSchema.optional(),
  categoryId: idSchema.nullable().optional(),
  brandId: idSchema.nullable().optional(),
  sizeId: idSchema.nullable().optional(),
  conditionId: idSchema.nullable().optional(),
  materialId: idSchema.nullable().optional(),
  patternId: idSchema.nullable().optional(),
  colourIds: z.array(idSchema).max(2).optional(),
  parcelSizeId: idSchema.nullable().optional(),
  priceMinor: minorUnitsSchema.nullable().optional(),
  currency: z.string().length(3).optional(),
  usedAiPhotos: z.boolean().optional(),
  photos: z.array(listingPhotoInputSchema).max(20).optional(),
});
export type ListingDraftInput = z.infer<typeof listingDraftInputSchema>;

/** POST /v1/listings. Creates a draft or publishes straight away when `publish` is true. */
export const createListingInputSchema = listingDraftInputSchema.extend({
  publish: z.boolean().default(false),
});
export type CreateListingInput = z.infer<typeof createListingInputSchema>;

/** What must be present to publish. The server also checks the category rules. */
export const publishableListingSchema = z.object({
  title: listingTitleSchema,
  categoryId: idSchema,
  conditionId: idSchema,
  priceMinor: minorUnitsSchema.min(1),
  parcelSizeId: idSchema,
  photos: z.array(listingPhotoInputSchema).min(1).max(20),
});

export const listingCardSchema = z.object({
  id: idSchema,
  status: z.enum(LISTING_STATUSES),
  title: z.string(),
  brandName: z.string().nullable(),
  sizeLabel: z.string().nullable(),
  conditionSlug: z.string().nullable(),
  priceMinor: z.number().int(),
  /** Item price plus the buyer protection fee, as the card shows it. */
  buyerPriceMinor: z.number().int(),
  previousPriceMinor: z.number().int().nullable(),
  currency: z.string().length(3),
  cover: photoSchema.nullable(),
  favouriteCount: z.number().int(),
  isFavourited: z.boolean().optional(),
  isBumped: z.boolean(),
  /** Seller is only included on endpoints where the card is not already inside a seller page. */
  seller: userSummarySchema.optional(),
});
export type ListingCard = z.infer<typeof listingCardSchema>;

export const listingDetailSchema = listingCardSchema.extend({
  description: z.string(),
  category: z.object({
    id: idSchema,
    path: z.string(),
    breadcrumb: z.array(z.object({ id: idSchema, slug: z.string() })),
  }),
  condition: z.object({ id: idSchema, slug: z.string() }).nullable(),
  size: z.object({ id: idSchema, label: z.string() }).nullable(),
  brand: z.object({ id: idSchema, name: z.string() }).nullable(),
  material: z.object({ id: idSchema, slug: z.string() }).nullable(),
  pattern: z.object({ id: idSchema, slug: z.string() }).nullable(),
  colours: z.array(z.object({ id: idSchema, slug: z.string() })),
  photos: z.array(photoSchema),
  parcelSizeId: idSchema.nullable(),
  postageFromMinor: z.number().int().nullable(),
  usedAiPhotos: z.boolean(),
  viewCount: z.number().int(),
  publishedAt: isoDateTimeSchema.nullable(),
  seller: userSummarySchema,
  /** What the viewer can do with it. Lets the app show or hide the sticky bar buttons. */
  viewer: z.object({
    isOwner: z.boolean(),
    isFavourited: z.boolean(),
    canBuy: z.boolean(),
    canOffer: z.boolean(),
    conversationId: idSchema.nullable(),
  }),
});
export type ListingDetail = z.infer<typeof listingDetailSchema>;

export const myListingsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["draft", "active", "reserved", "sold", "hidden"]).optional(),
});

export const myListingCardSchema = listingCardSchema.extend({
  viewCount: z.number().int(),
  publishedAt: isoDateTimeSchema.nullable(),
});
export const myListingsPageSchema = pageSchema(myListingCardSchema);

export const updateListingStatusInputSchema = z.object({
  status: z.enum(["active", "hidden"]),
});

/** Search and feed filters. Also what a saved search stores. */
export const searchFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: idSchema.optional(),
  brandIds: z.array(idSchema).max(20).optional(),
  sizeIds: z.array(idSchema).max(30).optional(),
  conditionIds: z.array(idSchema).max(5).optional(),
  colourIds: z.array(idSchema).max(10).optional(),
  materialIds: z.array(idSchema).max(10).optional(),
  patternIds: z.array(idSchema).max(10).optional(),
  priceMinMinor: minorUnitsSchema.optional(),
  priceMaxMinor: minorUnitsSchema.optional(),
  sellerId: idSchema.optional(),
  sort: z.enum(LISTING_SORTS).default("relevance"),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
