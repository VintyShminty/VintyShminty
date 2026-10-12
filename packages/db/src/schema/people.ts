import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES, PUSH_PLATFORMS } from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, pk, ts, updatedAt } from "./_helpers.js";
import { localeEnum, users } from "./auth.js";
import { brands, currencies, sizes } from "./reference.js";

export const notificationTypeEnum = pgEnum("notification_type", NOTIFICATION_TYPES);
export const notificationChannelEnum = pgEnum("notification_channel", NOTIFICATION_CHANNELS);
export const pushPlatformEnum = pgEnum("push_platform", PUSH_PLATFORMS);

/** Public profile. One row per user, created with the user. Counters are kept in step by the server. */
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    bio: text("bio"),
    /** Object storage key of the avatar photo. */
    avatarKey: text("avatar_key"),
    countryCode: char("country_code", { length: 2 }).notNull().default("IL"),
    city: text("city"),
    lastSeenAt: ts("last_seen_at"),
    followerCount: integer("follower_count").notNull().default(0),
    followingCount: integer("following_count").notNull().default(0),
    activeListingCount: integer("active_listing_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    /** Reviews written by members and automatic ones are scored apart, as in the spec. */
    memberReviewCount: integer("member_review_count").notNull().default(0),
    memberRatingSum: integer("member_rating_sum").notNull().default(0),
    automaticReviewCount: integer("automatic_review_count").notNull().default(0),
    automaticRatingSum: integer("automatic_rating_sum").notNull().default(0),
    /** Holiday mode hides all the seller's listings from the feed and search until it ends. */
    holidayModeEnabled: boolean("holiday_mode_enabled").notNull().default(false),
    holidayStartedAt: ts("holiday_started_at"),
    holidayEndsAt: ts("holiday_ends_at"),
    /** Code others type to be invited by this user. */
    inviteCode: text("invite_code").unique(),
    /** Set when the account is closed. The row stays so orders and reviews keep their history. */
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "profiles_counts_nonneg",
      sql`${t.followerCount} >= 0 and ${t.followingCount} >= 0 and ${t.activeListingCount} >= 0 and ${t.soldCount} >= 0`,
    ),
    index("profiles_holiday_idx").on(t.holidayModeEnabled).where(sql`${t.holidayModeEnabled}`),
  ],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  language: localeEnum("language").notNull().default("he"),
  currency: char("currency", { length: 3 })
    .notNull()
    .default("ILS")
    .references(() => currencies.code),
  /** Master switch for push. */
  pushEnabled: boolean("push_enabled").notNull().default(true),
  /** Daily push cap. Null means no limit. */
  pushDailyLimit: smallint("push_daily_limit"),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  /** Lets the feed use favourites, sizes and brands (Settings, Privacy). */
  personaliseFeed: boolean("personalise_feed").notNull().default(true),
  showLastSeen: boolean("show_last_seen").notNull().default(true),
  /** Seller shipping options (Settings, Postage). */
  shipFromHome: boolean("ship_from_home").notNull().default(false),
  shipFromDropoff: boolean("ship_from_dropoff").notNull().default(true),
  updatedAt: updatedAt(),
});

/** One row per notification type and channel the user changed. Missing rows use the default in shared. */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type, t.channel] })],
);

export const addresses = pgTable(
  "addresses",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"),
    fullName: text("full_name").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    postcode: text("postcode").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull().default("IL"),
    phone: text("phone"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("addresses_user_idx").on(t.userId),
    uniqueIndex("addresses_one_default_per_user").on(t.userId).where(sql`${t.isDefault}`),
  ],
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index("follows_followee_idx").on(t.followeeId, t.createdAt.desc()),
    check("follows_not_self", sql`${t.followerId} <> ${t.followeeId}`),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("blocks_blocked_idx").on(t.blockedId),
    check("blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

/** Personalisation: sizes the user cares about. */
export const userSizes = pgTable(
  "user_sizes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sizeId: uuid("size_id")
      .notNull()
      .references(() => sizes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sizeId] })],
);

/** Personalisation: brands the user follows. */
export const userBrands = pgTable(
  "user_brands",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.brandId] }), index("user_brands_brand_idx").on(t.brandId)],
);

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: pushPlatformEnum("platform").notNull(),
    deviceId: text("device_id"),
    locale: localeEnum("locale"),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId).where(sql`${t.revokedAt} is null`)],
);
