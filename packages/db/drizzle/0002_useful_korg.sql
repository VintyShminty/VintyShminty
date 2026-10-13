CREATE TABLE "listing_views" (
	"listing_id" uuid NOT NULL,
	"viewer_key" text NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "listing_views_listing_id_viewer_key_day_pk" PRIMARY KEY("listing_id","viewer_key","day")
);
--> statement-breakpoint
ALTER TABLE "listing_views" ADD CONSTRAINT "listing_views_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_views_day_idx" ON "listing_views" USING btree ("day");