import { AFFINITY_FEATURES, FEED_HIDE_SCOPES, FEED_SURFACES, USER_EVENT_TYPES } from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgMaterializedView,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, pk, ts } from "./_helpers.js";
import { users } from "./auth.js";
import { listings } from "./listings.js";

export const userEventTypeEnum = pgEnum("user_event_type", USER_EVENT_TYPES);
export const feedSurfaceEnum = pgEnum("feed_surface", FEED_SURFACES);
export const affinityFeatureEnum = pgEnum("affinity_feature", AFFINITY_FEATURES);
export const feedHideScopeEnum = pgEnum("feed_hide_scope", FEED_HIDE_SCOPES);

const uuidArray = customType<{ data: string[] }>({
  dataType() {
    return "uuid[]";
  },
});

/**
 * The action diary: what a signed in person did that says something about their taste. The server copies the item's
 * features in, so the history stays true when the listing is deleted and the app cannot fake it. Most rows are
 * "impression" (card seen). Raw rows are kept 180 days, impressions 30.
 */
export const userEvents = pgTable(
  "user_events",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: userEventTypeEnum("type").notNull(),
    /** Made by the app. A resent batch never counts twice. Null for events the server records itself. */
    clientEventId: uuid("client_event_id"),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    categoryId: uuid("category_id"),
    brandId: uuid("brand_id"),
    sizeId: uuid("size_id"),
    sellerId: uuid("seller_id"),
    /** 0 under 50, 1 for 50 to 100, 2 for 100 to 200, 3 for 200 to 400, 4 for 400 to 800, 5 for 800 and above. */
    priceBand: smallint("price_band"),
    surface: feedSurfaceEnum("surface"),
    position: smallint("position"),
    feedId: uuid("feed_id"),
    /** Search text, time on an item. */
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    occurredAt: ts("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    index("user_events_user_idx").on(t.userId, t.occurredAt.desc()),
    index("user_events_listing_idx").on(t.listingId, t.occurredAt.desc()),
    index("user_events_occurred_brin_idx").using("brin", t.occurredAt),
    uniqueIndex("user_events_client_event_uidx")
      .on(t.userId, t.clientEventId)
      .where(sql`${t.clientEventId} is not null`),
  ],
);

/**
 * A short summary sheet per person: how much they like Dresses, Zara, a size, a price band. A score fades to half
 * after 7 days without a new action; the math happens when a score is read or updated (see `effectiveScore`).
 * `feature_key` is a category id, brand id, seller id, size id, colour id, condition id or a price band "0" to "5".
 */
export const userAffinities = pgTable(
  "user_affinities",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feature: affinityFeatureEnum("feature").notNull(),
    featureKey: text("feature_key").notNull(),
    score: real("score").notNull(),
    scoredAt: ts("scored_at").notNull().defaultNow(),
    eventCount: integer("event_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.feature, t.featureKey] }),
    index("user_affinities_top_idx").on(t.userId, t.feature, t.score.desc()),
  ],
);

/** "Not interested": an item, a seller, a brand or a category the person does not want on the home feed. */
export const feedHidden = pgTable(
  "feed_hidden",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: feedHideScopeEnum("scope").notNull(),
    /** A listing, user, brand or category id. No foreign key, so a hide outlives its target. */
    targetId: uuid("target_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("feed_hidden_target_uidx").on(t.userId, t.scope, t.targetId)],
);

/** The sorted home list saved for 2 hours so pages never repeat or skip while the person scrolls. */
export const feedSnapshots = pgTable(
  "feed_snapshots",
  {
    id: pk(),
    /** Null for a visitor who is not signed in. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id"),
    mood: text("mood"),
    listingIds: uuidArray("listing_ids").notNull(),
    /** One entry per listing id, same order: `{ kind, name }` or null. */
    reasons: jsonb("reasons").notNull(),
    createdAt: createdAt(),
  },
  // No index: the table holds a few hours of rows and is read by its primary key.
);

/**
 * "Popular this week" per listing, re-counted every 15 minutes. The view itself is created by hand in the migration
 * (`REFRESH MATERIALIZED VIEW CONCURRENTLY`), this only describes it for queries.
 */
export const listingPopularity7d = pgMaterializedView("listing_popularity_7d", {
  listingId: uuid("listing_id").notNull(),
  pop: integer("pop").notNull(),
}).existing();
