ALTER TABLE "orders" ADD COLUMN "pay_by_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_unique" ON "orders" USING btree ("buyer_id","idempotency_key") WHERE "orders"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "orders_pay_by_idx" ON "orders" USING btree ("pay_by_at") WHERE "orders"."status" = 'pending_payment';--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_entries_idempotency_unique" ON "wallet_entries" USING btree ("user_id","idempotency_key") WHERE "wallet_entries"."idempotency_key" is not null;