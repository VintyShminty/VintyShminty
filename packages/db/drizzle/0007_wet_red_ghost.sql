CREATE TYPE "public"."report_source" AS ENUM('member', 'ai_check');--> statement-breakpoint
CREATE TYPE "public"."report_urgency" AS ENUM('high', 'normal', 'low');--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "reporter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "source" "report_source" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "ai_reason" "report_reason";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "urgency" "report_urgency";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "ai_summary" text;--> statement-breakpoint
CREATE INDEX "reports_review_idx" ON "reports" USING btree ("status","urgency","created_at");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_ai_summary_length" CHECK ("reports"."ai_summary" is null or char_length("reports"."ai_summary") <= 300);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_member_has_reporter" CHECK ("reports"."source" <> 'member' or "reports"."reporter_id" is not null);