CREATE TABLE "expense_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cadence" text NOT NULL,
	"name" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" char(3) DEFAULT 'ILS' NOT NULL,
	"paid_by" text DEFAULT '' NOT NULL,
	"paid_on" date NOT NULL,
	"created_by" uuid,
	CONSTRAINT "expense_items_cadence_valid" CHECK ("expense_items"."cadence" in ('yearly', 'one_time')),
	CONSTRAINT "expense_items_amount_not_negative" CHECK ("expense_items"."amount_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_items_paid_on_idx" ON "expense_items" USING btree ("paid_on");