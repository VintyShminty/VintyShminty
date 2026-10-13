CREATE TYPE "public"."affinity_feature" AS ENUM('category', 'parent_category', 'brand', 'seller', 'size', 'price_band', 'colour', 'condition');--> statement-breakpoint
CREATE TYPE "public"."feed_hide_scope" AS ENUM('item', 'seller', 'brand', 'category');--> statement-breakpoint
CREATE TYPE "public"."feed_surface" AS ENUM('home', 'search', 'browse');--> statement-breakpoint
CREATE TYPE "public"."user_event_type" AS ENUM('purchase', 'offer', 'message_seller', 'favourite', 'unfavourite', 'save_search', 'onboarding_pick', 'listing_open_repeat', 'listing_open', 'listing_dwell', 'search', 'category_visit', 'not_interested', 'impression');--> statement-breakpoint
CREATE TABLE "feed_hidden" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "feed_hide_scope" NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"category_id" uuid,
	"mood" text,
	"listing_ids" uuid[] NOT NULL,
	"reasons" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_affinities" (
	"user_id" uuid NOT NULL,
	"feature" "affinity_feature" NOT NULL,
	"feature_key" text NOT NULL,
	"score" real NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_affinities_user_id_feature_feature_key_pk" PRIMARY KEY("user_id","feature","feature_key")
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "user_event_type" NOT NULL,
	"client_event_id" uuid,
	"listing_id" uuid,
	"category_id" uuid,
	"brand_id" uuid,
	"size_id" uuid,
	"seller_id" uuid,
	"price_band" smallint,
	"surface" "feed_surface",
	"position" smallint,
	"feed_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_hidden" ADD CONSTRAINT "feed_hidden_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_snapshots" ADD CONSTRAINT "feed_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_affinities" ADD CONSTRAINT "user_affinities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_hidden_target_uidx" ON "feed_hidden" USING btree ("user_id","scope","target_id");--> statement-breakpoint
CREATE INDEX "user_affinities_top_idx" ON "user_affinities" USING btree ("user_id","feature","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_user_idx" ON "user_events" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_listing_idx" ON "user_events" USING btree ("listing_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_occurred_brin_idx" ON "user_events" USING brin ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_events_client_event_uidx" ON "user_events" USING btree ("user_id","client_event_id") WHERE "user_events"."client_event_id" is not null;
-- "Popular this week" per listing, re-counted every 15 minutes (REFRESH MATERIALIZED VIEW CONCURRENTLY).
-- An open counts 1 (a repeat open on another day counts the same here), a heart 4, a message to the seller 6.
CREATE MATERIALIZED VIEW "listing_popularity_7d" AS
SELECT "listing_id",
       (count(*) FILTER (WHERE "type" IN ('listing_open', 'listing_open_repeat'))
        + 4 * count(*) FILTER (WHERE "type" = 'favourite')
        + 6 * count(*) FILTER (WHERE "type" = 'message_seller'))::integer AS "pop"
FROM "user_events"
WHERE "occurred_at" > now() - interval '7 days' AND "listing_id" IS NOT NULL
GROUP BY "listing_id";--> statement-breakpoint
CREATE UNIQUE INDEX "listing_popularity_7d_listing_uidx" ON "listing_popularity_7d" ("listing_id");
