-- "Popular this week" counts each person once per listing and signal (docs/plans/home-feed.md section 13.2).
-- Before, one person hearting and unhearting the same listing ten times counted as ten hearts.
-- A materialized view cannot be changed in place, so it is dropped and made again. It holds no data of its own.
DROP MATERIALIZED VIEW "listing_popularity_7d";--> statement-breakpoint
CREATE MATERIALIZED VIEW "listing_popularity_7d" AS
SELECT "listing_id",
       (count(DISTINCT "user_id") FILTER (WHERE "type" IN ('listing_open', 'listing_open_repeat'))
        + 4 * count(DISTINCT "user_id") FILTER (WHERE "type" = 'favourite')
        + 6 * count(DISTINCT "user_id") FILTER (WHERE "type" = 'message_seller'))::integer AS "pop"
FROM "user_events"
WHERE "occurred_at" > now() - interval '7 days' AND "listing_id" IS NOT NULL
GROUP BY "listing_id";--> statement-breakpoint
CREATE UNIQUE INDEX "listing_popularity_7d_listing_uidx" ON "listing_popularity_7d" ("listing_id");
