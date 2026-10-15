CREATE TYPE "public"."listing_style" AS ENUM('vintage', 'y2k', 'streetwear', 'minimal', 'classic', 'quiet_luxury', 'boho', 'cottagecore', 'romantic', 'sporty', 'outdoor', 'preppy', 'grunge', 'goth', 'western', 'evening', 'workwear', 'summer', 'modest', 'basics');--> statement-breakpoint
ALTER TYPE "public"."affinity_feature" ADD VALUE 'style';--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "styles" "listing_style"[] DEFAULT '{}'::listing_style[] NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "styles_tagged_at" timestamp with time zone;