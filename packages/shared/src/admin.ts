import { z } from "zod";
import { NAME_MAX, usernameSchema } from "./auth.js";
import { idSchema, isoDateTimeSchema, localeSchema, localisedNameSchema, pageSchema } from "./common.js";
import { EXPENSE_CURRENCIES, EXPENSE_KINDS, KILL_SWITCH_NAMES, LISTING_STATUSES } from "./enums.js";
import { LISTING_COLOURS_MAX, LISTING_TITLE_MAX } from "./listing-rules.js";
import { brandNameSchema, listingDescriptionSchema, listingPhotoInputSchema } from "./listings.js";
import { currencyCodeSchema, minorUnitsSchema } from "./money.js";
import { PHOTO_ASSIST_MAX_PHOTOS } from "./photo-assist.js";

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

// Listing upload (phase 3): stand-in usernames, photos, AI pre-fill, batch publish, the uploaded items list

/** The AI meter action for the photo helper inside the listing upload page. Shown as its own line in Expenses. */
export const ADMIN_UPLOAD_AI_ACTION = "admin_upload_photo_check";
/** Most items in one publish call. The page sends bigger piles in several calls. */
export const ADMIN_UPLOAD_BATCH_MAX = 50;
export const OWNER_NAME_MIN = 2;
export const OWNER_NAME_MAX = 100;

/** Every stand-in account has an address ending in this. `.invalid` can never receive mail (RFC 2606). */
export const STAND_IN_EMAIL_DOMAIN = "stand-in.invalid";

/** Names a stand-in username may never take, so nobody mistakes it for the team or a system account. */
export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "staff",
  "support",
  "help",
  "official",
  "system",
  "root",
  "team",
  "vinty",
  "shminty",
  "vintyshminty",
  "null",
  "undefined",
  "anonymous",
] as const;

/** Lowercase with dots and underscores removed, so "Vinty_" and "v.inty" count as "vinty". */
export function isReservedUsername(username: string): boolean {
  const flat = username.toLowerCase().replace(/[._]/g, "");
  return (RESERVED_USERNAMES as readonly string[]).includes(flat);
}

/** The real owner of the clothes. Private: only admins ever see it. */
export const ownerFullNameSchema = z
  .string()
  .trim()
  .min(OWNER_NAME_MIN, "admin.upload.errors.ownerRequired")
  .max(OWNER_NAME_MAX, "admin.upload.errors.ownerTooLong");

export const standInSchema = z.object({
  id: idSchema,
  username: z.string(),
  displayName: z.string(),
  createdAt: isoDateTimeSchema,
  /** Listings by status. Drafts and removed ones are not counted. */
  listingCounts: z.object({
    active: count,
    reserved: count,
    sold: count,
    hidden: count,
  }),
  /** The distinct owner full names on its items. Private, admins only. */
  ownerNames: z.array(z.string()),
});
export type StandIn = z.infer<typeof standInSchema>;
export const standInsSchema = z.object({ items: z.array(standInSchema) });
export type StandIns = z.infer<typeof standInsSchema>;

export const createStandInInputSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(NAME_MAX, "validation.name.tooLong").optional(),
});
export type CreateStandInInput = z.infer<typeof createStandInInputSchema>;

/** POST /v1/admin/stand-ins/:id/uploads: a photo upload for the stand-in's own folder. Same body as a seller's photo. */
export const adminUploadRequestSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  byteSize: z.number().int().min(1).max(15_000_000),
});

export const adminSuggestInputSchema = z.object({
  photoKeys: z.array(z.string().min(1).max(300)).min(1).max(PHOTO_ASSIST_MAX_PHOTOS),
  language: localeSchema,
});

/** One item of a batch. What a normal listing needs, plus an optional owner name that replaces the batch one. */
export const adminListingItemSchema = z.object({
  /** The table row it came from. Sent back unchanged in the result. */
  clientId: z.string().max(64).optional(),
  ownerFullName: ownerFullNameSchema.optional(),
  title: z.string().trim().max(LISTING_TITLE_MAX),
  description: listingDescriptionSchema.default(""),
  categoryId: idSchema,
  brandId: idSchema.nullable().optional(),
  brandName: brandNameSchema.nullable().optional(),
  sizeId: idSchema.nullable().optional(),
  conditionId: idSchema.nullable().optional(),
  materialId: idSchema.nullable().optional(),
  patternId: idSchema.nullable().optional(),
  colourIds: z.array(idSchema).max(LISTING_COLOURS_MAX).default([]),
  /** Left out: the category's usual parcel size. */
  parcelSizeId: idSchema.nullable().optional(),
  priceMinor: minorUnitsSchema,
  currency: currencyCodeSchema.default("ILS"),
  photos: z.array(listingPhotoInputSchema).min(1).max(50),
  usedAiPhotos: z.boolean().default(false),
});
export type AdminListingItem = z.infer<typeof adminListingItemSchema>;
/** What a client sends: the fields with a default may be left out. */
export type AdminListingItemInput = z.input<typeof adminListingItemSchema>;

export const adminPublishInputSchema = z.object({
  ownerFullName: ownerFullNameSchema,
  items: z.array(adminListingItemSchema).min(1).max(ADMIN_UPLOAD_BATCH_MAX),
});
export type AdminPublishInput = z.input<typeof adminPublishInputSchema>;

export const adminPublishResultSchema = z.object({
  batchId: idSchema,
  username: z.string(),
  createdCount: count,
  failedCount: count,
  results: z.array(
    z.object({
      index: count,
      clientId: z.string().nullable(),
      ok: z.boolean(),
      listingId: idSchema.nullable(),
      /** A readable sentence when the item failed. */
      error: z.string().nullable(),
      /** The field that is wrong, as translation keys (validation.listing...), when the server knows. */
      fields: z.record(z.string(), z.string()).nullable(),
    }),
  ),
});
export type AdminPublishResult = z.infer<typeof adminPublishResultSchema>;

export const ADMIN_UPLOAD_STATUS_FILTERS = ["all", ...LISTING_STATUSES.filter((s) => s !== "draft")] as const;

export const adminUploadsFilterSchema = z.object({
  standInId: idSchema.optional(),
  /** Part of the owner's full name, any case. */
  owner: z.string().trim().max(OWNER_NAME_MAX).optional(),
  status: z.enum(ADMIN_UPLOAD_STATUS_FILTERS).default("all"),
});
export type AdminUploadsFilter = z.infer<typeof adminUploadsFilterSchema>;

export const adminUploadsQuerySchema = adminUploadsFilterSchema.extend({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminUploadsQuery = z.infer<typeof adminUploadsQuerySchema>;

export const adminUploadRowSchema = z.object({
  listingId: idSchema,
  uploadedAt: isoDateTimeSchema,
  batchId: idSchema.nullable(),
  /** Private. Never part of any public answer. */
  ownerFullName: z.string(),
  standInId: idSchema,
  username: z.string().nullable(),
  title: z.string(),
  categoryPath: localisedNameSchema.nullable(),
  brand: z.string().nullable(),
  size: z.string().nullable(),
  condition: localisedNameSchema.nullable(),
  priceMinor: z.number().int().nullable(),
  currency: z.string(),
  status: z.enum(LISTING_STATUSES),
  soldAt: isoDateTimeSchema.nullable(),
  /** What the buyer paid for the whole order. Null until the item is sold. */
  saleTotalMinor: z.number().int().nullable(),
});
export type AdminUploadRow = z.infer<typeof adminUploadRowSchema>;
export const adminUploadsPageSchema = pageSchema(adminUploadRowSchema);
export type AdminUploadsPage = z.infer<typeof adminUploadsPageSchema>;
