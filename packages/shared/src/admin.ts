import { z } from "zod";
import { idSchema, isoDateTimeSchema, pageSchema } from "./common.js";
import { EXPENSE_CURRENCIES, EXPENSE_KINDS, KILL_SWITCH_NAMES } from "./enums.js";

/** AI spend limits, in code on purpose (not editable from the panel). Millionths of a US dollar. */
export const AI_HOURLY_CAP_USD_MICROS = 2_000_000;
/** A calendar day in UTC, not a rolling 24 hours. */
export const AI_DAILY_CAP_USD_MICROS = 10_000_000;

const usdMicros = z.number().int().nonnegative();
const count = z.number().int().nonnegative();

/** `YYYY-MM`. */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

export const fixedCostSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Minor units of `currency` (agorot or cents). */
  amountMinor: z.number().int().min(0).max(100_000_000),
  currency: z.enum(EXPENSE_CURRENCIES),
  kind: z.enum(EXPENSE_KINDS),
});
export type FixedCostInput = z.infer<typeof fixedCostSchema>;

const fixedCostsSchema = z.array(fixedCostSchema).max(50);

// Dashboard

export const adminActionSchema = z.object({
  id: idSchema,
  createdAt: isoDateTimeSchema,
  /** Null when the system did it. */
  adminUsername: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
});
export type AdminAction = z.infer<typeof adminActionSchema>;

export const adminDashboardSchema = z.object({
  stats: z.object({
    totalUsers: count,
    newUsersLast7Days: count,
    activeListings: count,
    ordersLast30Days: count,
    aiSpendThisMonthUsdMicros: usdMicros,
    aiCallsToday: count,
  }),
  recentActions: z.array(adminActionSchema),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

// Users

export const ADMIN_USER_FILTERS = ["all", "admins", "sellers", "buyers", "banned"] as const;

export const adminUsersQuerySchema = z.object({
  filter: z.enum(ADMIN_USER_FILTERS).default("all"),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminUserSchema = z.object({
  id: idSchema,
  username: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["user", "moderator", "admin"]),
  banned: z.boolean(),
  createdAt: isoDateTimeSchema,
  lastSignInAt: isoDateTimeSchema.nullable(),
  listingCount: count,
  isStandIn: z.boolean(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUsersPageSchema = pageSchema(adminUserSchema);
export type AdminUsersPage = z.infer<typeof adminUsersPageSchema>;

export const setRoleInputSchema = z.object({ role: z.enum(["user", "admin"]) });
export type SetRoleInput = z.infer<typeof setRoleInputSchema>;

// Analytics

export const adminAnalyticsSchema = z.object({
  /** The last 8 weeks, oldest first. `weekStart` is the Monday (UTC) as YYYY-MM-DD. */
  weeks: z.array(z.object({ weekStart: z.string(), signups: count, newListings: count, orders: count })),
  aiThisMonth: z.array(
    z.object({
      action: z.string(),
      calls: count,
      inputTokens: count,
      outputTokens: count,
      costUsdMicros: usdMicros,
    }),
  ),
});
export type AdminAnalytics = z.infer<typeof adminAnalyticsSchema>;

// Expenses

export const adminExpensesQuerySchema = z.object({ month: monthSchema.optional() });

export const expenseRowSchema = z.object({
  name: z.string(),
  amountMinor: count,
  currency: z.enum(EXPENSE_CURRENCIES),
  kind: z.enum(EXPENSE_KINDS),
});

export const adminExpensesSchema = z.object({
  month: monthSchema,
  /** True when this month has its own saved list, false when the defaults are used. */
  usesOverride: z.boolean(),
  fixed: z.array(expenseRowSchema),
  /** One row per AI provider, worked out from the AI calls of the month. */
  auto: z.array(
    z.object({
      provider: z.string(),
      calls: count,
      inputTokens: count,
      outputTokens: count,
      costUsdMicros: usdMicros,
    }),
  ),
  byAction: z.array(
    z.object({
      action: z.string(),
      calls: count,
      inputTokens: count,
      outputTokens: count,
      costUsdMicros: usdMicros,
      averageCostUsdMicros: usdMicros,
    }),
  ),
  byModel: z.array(
    z.object({
      model: z.string(),
      calls: count,
      inputTokens: count,
      outputTokens: count,
      costUsdMicros: usdMicros,
    }),
  ),
  /** Shekels per dollar. */
  usdToIlsRate: z.number().positive(),
  /** Fixed costs plus AI spend, in agorot. */
  totalIlsMinor: count,
  /** The saved defaults, so the screen can edit them. */
  defaults: fixedCostsSchema,
});
export type AdminExpenses = z.infer<typeof adminExpensesSchema>;

export const expenseConfigInputSchema = z.object({
  fixedCosts: fixedCostsSchema,
  usdToIlsRate: z.number().min(0.1).max(100),
});
export type ExpenseConfigInput = z.infer<typeof expenseConfigInputSchema>;

export const expenseMonthInputSchema = z.object({ fixedCosts: fixedCostsSchema });
export type ExpenseMonthInput = z.infer<typeof expenseMonthInputSchema>;

export const expenseMonthParamsSchema = z.object({ month: monthSchema });

// Security

export const killSwitchSchema = z.object({
  name: z.enum(KILL_SWITCH_NAMES),
  enabled: z.boolean(),
  reason: z.string().nullable(),
  changedAt: isoDateTimeSchema.nullable(),
});
export type KillSwitch = z.infer<typeof killSwitchSchema>;

export const adminSecuritySchema = z.object({
  aiSpend: z.object({
    thisHourUsdMicros: usdMicros,
    todayUsdMicros: usdMicros,
    hourlyCapUsdMicros: usdMicros,
    dailyCapUsdMicros: usdMicros,
  }),
  switches: z.array(killSwitchSchema),
});
export type AdminSecurity = z.infer<typeof adminSecuritySchema>;

export const switchParamsSchema = z.object({ name: z.enum(KILL_SWITCH_NAMES) });
export const switchInputSchema = z.object({ enabled: z.boolean() });
export type SwitchInput = z.infer<typeof switchInputSchema>;
