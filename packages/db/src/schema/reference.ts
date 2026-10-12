import { ATTRIBUTE_MODES, SIZE_KINDS } from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
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
import { createdAt, pk, ts, updatedAt } from "./_helpers.js";

export const attributeModeEnum = pgEnum("attribute_mode", ATTRIBUTE_MODES);
export const sizeKindEnum = pgEnum("size_kind", SIZE_KINDS);

/** Currencies the platform knows. `is_enabled` decides which ones sellers may price in. */
export const currencies = pgTable("currencies", {
  code: char("code", { length: 3 }).primaryKey(),
  symbol: text("symbol").notNull(),
  minorUnitExponent: smallint("minor_unit_exponent").notNull().default(2),
  nameEn: text("name_en").notNull(),
  nameHe: text("name_he").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
});

export const parcelSizes = pgTable(
  "parcel_sizes",
  {
    id: pk(),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameHe: text("name_he").notNull(),
    descriptionEn: text("description_en").notNull(),
    descriptionHe: text("description_he").notNull(),
    maxWeightGrams: integer("max_weight_grams").notNull(),
    /** Longest side in millimetres. */
    maxLengthMm: integer("max_length_mm").notNull(),
    /** Simulated postage price. Real carrier prices replace this when shipping goes live. */
    priceMinor: integer("price_minor").notNull(),
    currency: char("currency", { length: 3 })
      .notNull()
      .default("ILS")
      .references(() => currencies.code),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [check("parcel_sizes_price_nonneg", sql`${t.priceMinor} >= 0`)],
);

export const sizeGroups = pgTable("size_groups", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameHe: text("name_he").notNull(),
  kind: sizeKindEnum("kind").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const sizes = pgTable(
  "sizes",
  {
    id: pk(),
    sizeGroupId: uuid("size_group_id")
      .notNull()
      .references(() => sizeGroups.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    /** What is printed on the tile, such as "M", "42" or "W32". */
    label: text("label").notNull(),
    nameEn: text("name_en").notNull(),
    nameHe: text("name_he").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [
    unique("sizes_group_slug_unique").on(t.sizeGroupId, t.slug),
    index("sizes_group_idx").on(t.sizeGroupId, t.sortOrder),
  ],
);

/**
 * The category tree. `path` is the slugs from the root joined with "/", for example
 * "women/clothing/dresses". A prefix match on `path` finds a whole subtree without a recursive query.
 * The attribute modes tell the sell form which rows to show for this category.
 */
export const categories = pgTable(
  "categories",
  {
    id: pk(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    path: text("path").notNull().unique(),
    depth: smallint("depth").notNull().default(0),
    nameEn: text("name_en").notNull(),
    nameHe: text("name_he").notNull(),
    /** Lucide icon name. */
    icon: text("icon"),
    sortOrder: smallint("sort_order").notNull().default(0),
    isLeaf: boolean("is_leaf").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    brandMode: attributeModeEnum("brand_mode").notNull().default("optional"),
    sizeMode: attributeModeEnum("size_mode").notNull().default("hidden"),
    conditionMode: attributeModeEnum("condition_mode").notNull().default("required"),
    colourMode: attributeModeEnum("colour_mode").notNull().default("optional"),
    materialMode: attributeModeEnum("material_mode").notNull().default("hidden"),
    patternMode: attributeModeEnum("pattern_mode").notNull().default("hidden"),
    defaultParcelSizeId: uuid("default_parcel_size_id").references(() => parcelSizes.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("categories_parent_idx").on(t.parentId, t.sortOrder),
    index("categories_path_prefix_idx").on(t.path.op("text_pattern_ops")),
  ],
);

/** Which size groups a category offers. A category can offer more than one (letters and numbers). */
export const categorySizeGroups = pgTable(
  "category_size_groups",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    sizeGroupId: uuid("size_group_id")
      .notNull()
      .references(() => sizeGroups.id, { onDelete: "cascade" }),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.sizeGroupId] }),
    index("category_size_groups_group_idx").on(t.sizeGroupId),
  ],
);

export const conditions = pgTable("conditions", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameHe: text("name_he").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionHe: text("description_he").notNull(),
  /** 1 is best. Used for sorting and display. */
  rank: smallint("rank").notNull(),
});

export const colours = pgTable("colours", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameHe: text("name_he").notNull(),
  /** Swatch shown in the filter. Reference data, not a UI token. */
  swatchHex: text("swatch_hex").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const materials = pgTable("materials", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameHe: text("name_he").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const patterns = pgTable("patterns", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameHe: text("name_he").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const brands = pgTable(
  "brands",
  {
    id: pk(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    logoKey: text("logo_key"),
    /** Higher shows first in pickers. */
    popularity: integer("popularity").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("brands_popularity_idx").on(t.popularity.desc(), t.name)],
);

/**
 * The buyer protection fee as data. Only one rule per currency is active at a time.
 * Version 1 shows the fee but charges nothing.
 */
export const feeRules = pgTable(
  "fee_rules",
  {
    id: pk(),
    currency: char("currency", { length: 3 })
      .notNull()
      .references(() => currencies.code),
    buyerFeeBasisPoints: integer("buyer_fee_basis_points").notNull(),
    buyerFeeFixedMinor: integer("buyer_fee_fixed_minor").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    activeFrom: ts("active_from").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    check("fee_rules_bp_range", sql`${t.buyerFeeBasisPoints} between 0 and 10000`),
    check("fee_rules_fixed_nonneg", sql`${t.buyerFeeFixedMinor} >= 0`),
    unique("fee_rules_currency_active_from_unique").on(t.currency, t.activeFrom),
  ],
);

/** Paid promotion products. Priced at 0 in version 1 so bumps are free but the model is ready for prices. */
export const bumpPlans = pgTable(
  "bump_plans",
  {
    id: pk(),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameHe: text("name_he").notNull(),
    durationHours: integer("duration_hours").notNull(),
    priceMinor: integer("price_minor").notNull().default(0),
    currency: char("currency", { length: 3 })
      .notNull()
      .default("ILS")
      .references(() => currencies.code),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [check("bump_plans_price_nonneg", sql`${t.priceMinor} >= 0`)],
);

/** Tunable numbers (offer limit, hold times) as data so they can change without a release. */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: updatedAt(),
});
