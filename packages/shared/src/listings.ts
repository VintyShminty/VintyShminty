import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  localisedNameSchema,
  pageSchema,
  paginationQuerySchema,
  photoSchema,
} from "./common.js";
import { LISTING_SORTS, LISTING_STATUSES } from "./enums.js";
import {
  LISTING_COLOURS_MAX,
  LISTING_DESCRIPTION_MAX,
  LISTING_TITLE_MAX,
  LISTING_TITLE_MIN,
} from "./listing-rules.js";
import { currencyCodeSchema, minorUnitsSchema } from "./money.js";
import { userSummarySchema } from "./users.js";

export const listingTitleSchema = z
  .string()
  .trim()
  .min(LISTING_TITLE_MIN, "validation.listing.title.tooShort")
  .max(LISTING_TITLE_MAX, "validation.listing.title.tooLong");
export const listingDescriptionSchema = z
  .string()
  .trim()
  .max(LISTING_DESCRIPTION_MAX, "validation.listing.description.tooLong");

/** A photo the app already uploaded to storage. Position 0 is the cover. */
export const listingPhotoInputSchema = z.object({
  key: z.string().min(1).max(300),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]).default("image/jpeg"),
  byteSize: z.number().int().positive().optional(),
  placeholder: z.string().max(200).optional(),
});
export type ListingPhotoInput = z.infer<typeof listingPhotoInputSchema>;

/**
 * A brand typed by the seller that is not on our list. Trimmed, spaces collapsed, no control characters, 2 to 60 characters
 * (the same limits as a brand request).
 */
export function cleanBrandName(raw: string): string {
  return raw.replace(/\p{C}/gu, " ").replace(/\s+/gu, " ").trim();
}
export const brandNameSchema = z
  .string()
  .transform(cleanBrandName)
  .pipe(z.string().min(2, "validation.brandRequest.tooShort").max(60, "validation.brandRequest.tooLong"));

/**
 * Fields shared by drafts and published listings. A draft may be incomplete, so the title only has a ceiling here.
 * What is required to go live depends on the category and is checked by `validateListing` (listing-rules.ts).
 */
export const listingDraftInputSchema = z.object({
  title: z.string().trim().max(LISTING_TITLE_MAX, "validation.listing.title.tooLong").optional(),
  description: listingDescriptionSchema.optional(),
  categoryId: idSchema.nullable().optional(),
  brandId: idSchema.nullable().optional(),
  /** A brand that is not on our list. Used only when `brandId` is empty. */
  brandName: brandNameSchema.nullable().optional(),
  sizeId: idSchema.nullable().optional(),
  conditionId: idSchema.nullable().optional(),
  materialId: idSchema.nullable().optional(),
  patternId: idSchema.nullable().optional(),
  colourIds: z.array(idSchema).max(LISTING_COLOURS_MAX, "validation.listing.colour.tooMany").optional(),
  parcelSizeId: idSchema.nullable().optional(),
  priceMinor: minorUnitsSchema.nullable().optional(),
  currency: currencyCodeSchema.optional(),
  usedAiPhotos: z.boolean().optional(),
  photos: z.array(listingPhotoInputSchema).max(50).optional(),
});
export type ListingDraftInput = z.infer<typeof listingDraftInputSchema>;

/** POST /v1/listings. Creates a draft or publishes straight away when `publish` is true. */
export const createListingInputSchema = listingDraftInputSchema.extend({
  publish: z.boolean().default(false),
});
export type CreateListingInput = z.infer<typeof createListingInputSchema>;

/** What must be present to publish, whatever the category. The category rules add to this on the server. */
export const publishableListingSchema = z.object({
  title: listingTitleSchema,
  categoryId: idSchema,
  priceMinor: minorUnitsSchema.min(1),
  parcelSizeId: idSchema,
  photos: z.array(listingPhotoInputSchema).min(1),
});

export const listingCardSchema = z.object({
  id: idSchema,
  status: z.enum(LISTING_STATUSES),
  title: z.string(),
  brandName: z.string().nullable(),
  /** Ids the Home feed needs for "Show less of this brand or category" (Milestone 7). */
  brandId: idSchema.nullable().optional(),
  categoryId: idSchema.nullable().optional(),
  sizeLabel: z.string().nullable(),
  conditionSlug: z.string().nullable(),
  priceMinor: z.number().int(),
  /** Item price plus the buyer protection fee, as the card shows it. */
  buyerPriceMinor: z.number().int(),
  previousPriceMinor: z.number().int().nullable(),
  currency: z.string().length(3),
  cover: photoSchema.nullable(),
  /** All photos in order, card-sized, cover first. Only sent where cards are drawn on the website/app grids. */
  photos: z.array(photoSchema).optional(),
  favouriteCount: z.number().int(),
  isFavourited: z.boolean().optional(),
  isBumped: z.boolean(),
  /** When the buzz ends. Only sent on the owner's own views, and only while the item is buzzing. */
  bumpedUntil: isoDateTimeSchema.nullable().optional(),
  /** Seller is only included on endpoints where the card is not already inside a seller page. */
  seller: userSummarySchema.optional(),
});
export type ListingCard = z.infer<typeof listingCardSchema>;

const namedRefSchema = z.object({ id: idSchema, slug: z.string(), name: localisedNameSchema });

/** One listing in full. On the owner's own view a draft may still lack a price, a category and photos. */
export const listingDetailSchema = listingCardSchema.extend({
  priceMinor: z.number().int().nullable(),
  buyerPriceMinor: z.number().int().nullable(),
  description: z.string(),
  category: z
    .object({
      id: idSchema,
      path: z.string(),
      name: localisedNameSchema,
      breadcrumb: z.array(z.object({ id: idSchema, slug: z.string(), name: localisedNameSchema })),
    })
    .nullable(),
  condition: namedRefSchema.nullable(),
  size: z.object({ id: idSchema, label: z.string() }).nullable(),
  /** `id` is null for a brand the seller typed that is not on our list. */
  brand: z.object({ id: idSchema.nullable(), name: z.string() }).nullable(),
  material: namedRefSchema.nullable(),
  pattern: namedRefSchema.nullable(),
  colours: z.array(namedRefSchema.extend({ swatchHex: z.string() })),
  photos: z.array(photoSchema),
  parcelSizeId: idSchema.nullable(),
  postageFromMinor: z.number().int().nullable(),
  usedAiPhotos: z.boolean(),
  viewCount: z.number().int(),
  publishedAt: isoDateTimeSchema.nullable(),
  updatedAt: isoDateTimeSchema,
  seller: userSummarySchema,
  /** The seller is on holiday: the item opens from a link but is not in the feed or search, and cannot be bought. */
  sellerOnHoliday: z.boolean(),
  /** When the seller is back, if they gave a date. Only set while they are away. */
  sellerAwayUntil: isoDateTimeSchema.nullable(),
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

export const MY_LISTING_STATUSES = ["draft", "active", "reserved", "sold", "hidden"] as const;
export type MyListingStatus = (typeof MY_LISTING_STATUSES)[number];

export const myListingsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(MY_LISTING_STATUSES).optional(),
});

/** A card on the owner's own page. Drafts may have no price yet and no title. */
export const myListingCardSchema = listingCardSchema.extend({
  priceMinor: z.number().int().nullable(),
  buyerPriceMinor: z.number().int().nullable(),
  viewCount: z.number().int(),
  publishedAt: isoDateTimeSchema.nullable(),
  updatedAt: isoDateTimeSchema,
});
export type MyListingCard = z.infer<typeof myListingCardSchema>;

export const myListingsPageSchema = pageSchema(myListingCardSchema).extend({
  /** How many listings the person has in each state, for the numbers on the chips. */
  counts: z.object({
    draft: z.number().int(),
    active: z.number().int(),
    reserved: z.number().int(),
    sold: z.number().int(),
    hidden: z.number().int(),
  }),
});
export type MyListingsPage = z.infer<typeof myListingsPageSchema>;

/**
 * PATCH /v1/listings/:id/status. The seller pauses (hidden) and shows again (active), holds it for someone
 * (reserved) and marks it sold by hand. Selling through an order arrives with Milestone 5.
 */
export const updateListingStatusInputSchema = z.object({
  status: z.enum(["active", "hidden", "reserved", "sold"]),
});
export type UpdateListingStatusInput = z.infer<typeof updateListingStatusInputSchema>;

export const replaceListingPhotosInputSchema = z.object({
  photos: z.array(listingPhotoInputSchema).max(50),
});

/** GET /v1/pricing/preview. What a buyer would pay for an item price, from the active fee rule. */
export const pricePreviewQuerySchema = z.object({
  priceMinor: z.coerce.number().int().min(0).max(2_000_000_000),
  currency: currencyCodeSchema.default("ILS"),
});
export const pricePreviewSchema = z.object({
  priceMinor: z.number().int(),
  currency: z.string().length(3),
  buyerProtectionFeeMinor: z.number().int(),
  buyerPriceMinor: z.number().int(),
});
export type PricePreview = z.infer<typeof pricePreviewSchema>;

/** POST /v1/brand-requests. A seller asks for a brand that is not on the list. */
export const brandRequestInputSchema = z.object({
  name: brandNameSchema,
});

/** Search and feed filters. Also what a saved search stores. */
export const searchFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: idSchema.optional(),
  /** Several categories at once (a Browse tile covers a few). Each one includes everything below it. */
  categoryIds: z.array(idSchema).max(40).optional(),
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
