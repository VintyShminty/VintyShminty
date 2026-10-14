import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, pk, ts } from "./_helpers.js";
import { users } from "./auth.js";
import { listings } from "./listings.js";

/** One fixed monthly cost. `amountMinor` is in minor units of `currency` (agorot or cents). */
export type FixedCost = {
  name: string;
  amountMinor: number;
  currency: "ILS" | "USD";
  kind: "subscription" | "configured";
};

/** One row per AI call, written by the one wrapper every AI call goes through (lib/ai-cost.ts). */
export const aiCalls = pgTable(
  "ai_calls",
  {
    id: pk(),
    createdAt: createdAt(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    /** Short machine name of the feature, for example photo_check. */
    action: text("action").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    /** Cost in millionths of a US dollar, so tiny calls do not round to zero. */
    costUsdMicros: bigint("cost_usd_micros", { mode: "number" }).notNull().default(0),
    ok: boolean("ok").notNull().default(true),
  },
  (t) => [
    index("ai_calls_created_idx").on(t.createdAt),
    index("ai_calls_action_created_idx").on(t.action, t.createdAt),
  ],
);

/** The admin audit log. Only ever inserted into, never updated or deleted by code. */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: pk(),
    createdAt: createdAt(),
    /** Null when the system did it (for example the AI cap switched itself off). */
    adminUserId: uuid("admin_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("admin_actions_created_idx").on(t.createdAt.desc())],
);

/** Master switches. A missing row means the switch is on (enabled). */
export const killSwitches = pgTable("kill_switches", {
  name: text("name").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  changedAt: ts("changed_at").notNull().defaultNow(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
});

/** The default fixed monthly costs and the dollar rate. One row, id is always 1. */
export const expenseConfig = pgTable("expense_config", {
  id: integer("id").primaryKey().default(1),
  fixedCosts: jsonb("fixed_costs").$type<FixedCost[]>().notNull().default(sql`'[]'::jsonb`),
  /** ILS per 1 USD times 10000 (3.6 shekels is 36000), so the rate stays an integer. */
  usdToIlsRateX10000: integer("usd_to_ils_rate_x10000").notNull().default(36000),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

/** Fixed costs for one month that differ from the defaults. No row means use the defaults. */
export const expenseMonths = pgTable("expense_months", {
  /** YYYY-MM */
  month: text("month").primaryKey(),
  fixedCosts: jsonb("fixed_costs").$type<FixedCost[]>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

/** Marks a public seller that admins created to hold uploaded clothes. These people cannot log in. */
export const standInSellers = pgTable("stand_in_sellers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  note: text("note"),
});

/** Who really owns a listing that an admin uploaded for a stand in seller. The name is private, admins only. */
export const adminUploads = pgTable(
  "admin_uploads",
  {
    listingId: uuid("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    ownerFullName: text("owner_full_name").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    batchId: uuid("batch_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("admin_uploads_owner_idx").on(t.ownerFullName),
    index("admin_uploads_created_idx").on(t.createdAt),
  ],
);
