DROP INDEX "listings_search_idx";--> statement-breakpoint
DROP INDEX "listings_feed_idx";--> statement-breakpoint
DROP INDEX "listings_category_feed_idx";--> statement-breakpoint
DROP INDEX "listings_price_idx";--> statement-breakpoint
DROP INDEX "listings_brand_idx";--> statement-breakpoint
DROP INDEX "listings_size_idx";--> statement-breakpoint
DROP INDEX "listings_condition_idx";--> statement-breakpoint
DROP INDEX "listings_material_idx";--> statement-breakpoint
CREATE INDEX "listings_search_idx" ON "listings" USING gin ("search_vector") WHERE "listings"."status" in ('active', 'reserved');--> statement-breakpoint
CREATE INDEX "listings_feed_idx" ON "listings" USING btree ("bumped_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "listings"."status" in ('active', 'reserved');--> statement-breakpoint
CREATE INDEX "listings_category_feed_idx" ON "listings" USING btree ("category_id","bumped_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "listings"."status" in ('active', 'reserved');--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price_minor","id") WHERE "listings"."status" in ('active', 'reserved');--> statement-breakpoint
CREATE INDEX "listings_brand_idx" ON "listings" USING btree ("brand_id","bumped_at" DESC NULLS LAST) WHERE "listings"."status" in ('active', 'reserved');--> statement-breakpoint
CREATE INDEX "listings_size_idx" ON "listings" USING btree ("size_id","bumped_at" DESC NULLS LAST) WHERE "listings"."status" in ('active', 'reserved');--> statement-breakpoint
CREATE INDEX "listings_condition_idx" ON "listings" USING btree ("condition_id") WHERE "listings"."status" in ('active', 'reserved');--> statement-breakpoint
CREATE INDEX "listings_material_idx" ON "listings" USING btree ("material_id") WHERE "listings"."status" in ('active', 'reserved');