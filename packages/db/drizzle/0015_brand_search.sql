CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "name_he" text;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "brands_name_trgm_idx" ON "brands" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "brands_name_he_trgm_idx" ON "brands" USING gin (lower("name_he") gin_trgm_ops);
