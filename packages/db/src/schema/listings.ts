import { BUNDLE_STATUSES, LISTING_STATUSES, LISTING_STYLES } from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currencyCol, pk, ts, tsvector, updatedAt } from "./_helpers.js";
import { users } from "./auth.js";
import {
  brands,
  bumpPlans,
  categories,
  colours,
  conditions,
  currencies,
  materials,
  parcelSizes,
  patterns,
  sizes,
} from "./reference.js";

export const listingStatusEnum = pgEnum("listing_status", LISTING_STATUSES);
export const listingStyleEnum = pgEnum("listing_style", LISTING_STYLES);
export const bundleStatusEnum = pgEnum("bundle_status", BUNDLE_STATUSES);

export const listings = pgTable(
  "listings",
  {
    id: pk(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: listingStatusEnum("status").notNull().default("draft"),
    /** Why a listing is hidden or removed. Plain text for moderators. */
    statusReason: text("status_reason"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "restrict" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    /** Brand name copied at write time so cards and search never need a join. */
    brandName: text("brand_name"),
    sizeId: uuid("size_id").references(() => sizes.id, { onDelete: "set null" }),
    conditionId: uuid("condition_id").references(() => conditions.id, { onDelete: "restrict" }),
    materialId: uuid("material_id").references(() => materials.id, { onDelete: "set null" }),
    patternId: uuid("pattern_id").references(() => patterns.id, { onDelete: "set null" }),
    parcelSizeId: uuid("parcel_size_id").references(() => parcelSizes.id, { onDelete: "set null" }),
    /** Item price in minor units. The buyer fee is added on top at display time. */
    priceMinor: integer("price_minor"),
    currency: currencyCol().references(() => currencies.code),
    /** Price before the latest drop. Set only when the price went down. Drives the "Price drop" badge. */
    previousPriceMinor: integer("previous_price_minor"),
    /** Up to 3 style tags from the AI listing check (D-040). Behind the scenes only: never in any API answer. */
    styles: listingStyleEnum("styles").array().notNull().default(sql`'{}'::listing_style[]`),
    /** When the styles were last read. Null means never tagged, the nightly catch-up picks those up. */
    stylesTaggedAt: ts("styles_tagged_at"),
    usedAiPhotos: boolean("used_ai_photos").notNull().default(false),
    countryCode: char("country_code", { length: 2 }).notNull().default("IL"),
    city: text("city"),
    viewCount: integer("view_count").notNull().default(0),
    favouriteCount: integer("favourite_count").notNull().default(0),
    /** Feed order. Equals publishedAt until the listing is bumped or relisted. */
    bumpedAt: ts("bumped_at").notNull().defaultNow(),
    /** While in the future the card shows the "Bumped" badge. */
    bumpedUntil: ts("bumped_until"),
    publishedAt: ts("published_at"),
    soldAt: ts("sold_at"),
    /** Set while the status is reserved: who it is held for and until when. */
    reservedForUserId: uuid("reserved_for_user_id").references(() => users.id, { onDelete: "set null" }),
    reservedUntil: ts("reserved_until"),
    /** Generated. Title and brand weigh most, then the description. Config "simple" works for Hebrew and English. */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(brand_name, '')), 'A') || setweight(to_tsvector('simple', coalesce(description, '')), 'B')`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("listings_price_nonneg", sql`${t.priceMinor} is null or ${t.priceMinor} >= 0`),
    check("listings_counts_nonneg", sql`${t.viewCount} >= 0 and ${t.favouriteCount} >= 0`),
    check(
      "listings_published_has_price",
      sql`${t.status} in ('draft', 'removed') or (${t.priceMinor} is not null and ${t.categoryId} is not null)`,
    ),
    // Full-text search over live listings only.
    index("listings_search_idx").using("gin", t.searchVector).where(sql`${t.status} = 'active'`),
    // Home feed and "newest": active listings by bump order, with id as the cursor tie breaker.
    index("listings_feed_idx").on(t.bumpedAt.desc(), t.id.desc()).where(sql`${t.status} = 'active'`),
    // Category pages. Subtree filters use category_id IN (...) so category leads.
    index("listings_category_feed_idx")
      .on(t.categoryId, t.bumpedAt.desc(), t.id.desc())
      .where(sql`${t.status} = 'active'`),
    index("listings_price_idx").on(t.priceMinor, t.id).where(sql`${t.status} = 'active'`),
    index("listings_brand_idx").on(t.brandId, t.bumpedAt.desc()).where(sql`${t.status} = 'active'`),
    index("listings_size_idx").on(t.sizeId, t.bumpedAt.desc()).where(sql`${t.status} = 'active'`),
    index("listings_condition_idx").on(t.conditionId).where(sql`${t.status} = 'active'`),
    index("listings_material_idx").on(t.materialId).where(sql`${t.status} = 'active'`),
    // A member's own page: Active and Sold chips, newest first.
    index("listings_seller_idx").on(t.sellerId, t.status, t.createdAt.desc()),
    index("listings_reserved_idx").on(t.reservedUntil).where(sql`${t.status} = 'reserved'`),
  ],
);

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: pk(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    /** Object storage key. The URL is built from the bucket base URL and this key. */
    objectKey: text("object_key").notNull().unique(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    contentType: text("content_type").notNull().default("image/jpeg"),
    byteSize: integer("byte_size"),
    /**
     * Small copy (about 480 px wide, WebP) used by cards and lists so the feed does not download the full photo.
     * Null until it is made (the daily photo job fills old rows). Equal to object_key when the file could not be
     * resized, which tells the job not to try again. The key never changes content, so it is cached for a year.
     */
    cardObjectKey: text("card_object_key"),
    /** Tiny blurred preview, a blurhash string, shown while the photo loads. */
    placeholder: text("placeholder"),
    /** 0 is the cover photo ("Main"). */
    position: smallint("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("listing_photos_listing_idx").on(t.listingId, t.position),
    check("listing_photos_size_positive", sql`${t.width} > 0 and ${t.height} > 0`),
  ],
);

export const listingColours = pgTable(
  "listing_colours",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    colourId: uuid("colour_id")
      .notNull()
      .references(() => colours.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.colourId] }),
    index("listing_colours_colour_idx").on(t.colourId, t.listingId),
  ],
);

export const listingPriceHistory = pgTable(
  "listing_price_history",
  {
    id: pk(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    oldPriceMinor: integer("old_price_minor").notNull(),
    newPriceMinor: integer("new_price_minor").notNull(),
    changedAt: ts("changed_at").notNull().defaultNow(),
  },
  (t) => [index("listing_price_history_listing_idx").on(t.listingId, t.changedAt.desc())],
);

export const favourites = pgTable(
  "favourites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listingId] }),
    // "Favourite items" page, newest first.
    index("favourites_user_idx").on(t.userId, t.createdAt.desc()),
    index("favourites_listing_idx").on(t.listingId),
  ],
);

/**
 * One row per viewer per listing per day. Inserting it (and only when it was new) is what bumps
 * `listings.view_count`, so refreshing the page never counts twice.
 */
export const listingViews = pgTable(
  "listing_views",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    /** `u:<user id>` for a signed in viewer, `a:<hash of the address>` for a visitor. */
    viewerKey: text("viewer_key").notNull(),
    day: date("day", { mode: "string" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.viewerKey, t.day] }),
    index("listing_views_day_idx").on(t.day),
  ],
);

/** A search the user saved with the bookmark. `filters` is the same object the search endpoint takes. */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    queryText: text("query_text"),
    filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
    notifyOnNew: boolean("notify_on_new").notNull().default(true),
    lastNotifiedAt: ts("last_notified_at"),
    createdAt: createdAt(),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId, t.createdAt.desc())],
);

/** Recent searches shown when the search field is tapped. */
export const recentSearches = pgTable(
  "recent_searches",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    queryText: text("query_text").notNull(),
    filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
    resultCount: integer("result_count"),
    createdAt: createdAt(),
  },
  (t) => [index("recent_searches_user_idx").on(t.userId, t.createdAt.desc())],
);

/** A seller's bundle discount ladder: buy at least N items, get P percent off. */
export const bundleDiscountTiers = pgTable(
  "bundle_discount_tiers",
  {
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    minItems: smallint("min_items").notNull(),
    percentOff: smallint("percent_off").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sellerId, t.minItems] }),
    check("bundle_tiers_valid", sql`${t.minItems} >= 2 and ${t.percentOff} between 1 and 100`),
  ],
);

/** A buyer assembling several items from one seller before checkout. */
export const bundles = pgTable(
  "bundles",
  {
    id: pk(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: bundleStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bundles_buyer_idx").on(t.buyerId, t.status),
    check("bundles_not_self", sql`${t.buyerId} <> ${t.sellerId}`),
  ],
);

export const bundleItems = pgTable(
  "bundle_items",
  {
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => bundles.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    addedAt: ts("added_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.bundleId, t.listingId] }),
    index("bundle_items_listing_idx").on(t.listingId),
  ],
);

/** One promotion of one listing. Free in version 1 (price 0), the columns for a real price exist. */
export const bumps = pgTable(
  "bumps",
  {
    id: pk(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => bumpPlans.id, { onDelete: "restrict" }),
    pricePaidMinor: integer("price_paid_minor").notNull().default(0),
    currency: currencyCol().references(() => currencies.code),
    /** 'free' in version 1. Later 'simulated' or a real provider name. */
    paymentProvider: text("payment_provider").notNull().default("free"),
    startsAt: ts("starts_at").notNull().defaultNow(),
    endsAt: ts("ends_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("bumps_listing_idx").on(t.listingId, t.startsAt.desc()),
    index("bumps_user_idx").on(t.userId, t.startsAt.desc()),
    unique("bumps_listing_start_unique").on(t.listingId, t.startsAt),
    check("bumps_dates_ordered", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
