import { z } from "zod";
import { idSchema, isoDateTimeSchema, pageSchema } from "./common.js";
import {
  LISTING_STATUSES,
  ORDER_STATUSES,
  REPORT_REASONS,
  REPORT_SOURCES,
  REPORT_STATUSES,
  REPORT_TARGETS,
  REPORT_URGENCIES,
} from "./enums.js";

/**
 * The admin Review list (D-038): member reports and the AI listing check's flags in one list, most urgent first. The AI
 * sorts and summarises, it never hides, removes or bans. Only an admin's action changes anything.
 */

/** The AI's one line for Eden. */
export const REVIEW_SUMMARY_MAX = 300;

/** Open means waiting for a look. Handled covers actioned and dismissed. */
export const REVIEW_FILTERS = ["open", "handled"] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

/** GET /v1/admin/review */
export const adminReviewQuerySchema = z.object({
  status: z.enum(REVIEW_FILTERS).default("open"),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;

/** What the report is about, enough to recognise it without opening it. Null when the target no longer exists. */
export const reviewTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("listing"),
    id: idSchema,
    title: z.string(),
    status: z.enum(LISTING_STATUSES),
    /** The cover photo, null without one. */
    photoUrl: z.string().nullable(),
    priceMinor: z.number().int().nullable(),
    currency: z.string().nullable(),
    seller: z.object({ id: idSchema, username: z.string() }),
  }),
  z.object({ kind: z.literal("user"), id: idSchema, username: z.string() }),
  /** An order a buyer opened a problem on (D-044). The AI summary says what happened, it suggests no outcome. */
  z.object({
    kind: z.literal("order"),
    id: idSchema,
    status: z.enum(ORDER_STATUSES),
    listingTitle: z.string(),
    photoUrl: z.string().nullable(),
    totalMinor: z.number().int(),
    currency: z.string(),
    buyer: z.object({ id: idSchema, username: z.string() }),
    seller: z.object({ id: idSchema, username: z.string() }),
    /** What the buyer wrote when opening the problem. */
    problemNote: z.string().nullable(),
  }),
  /** Messages and reviews: who wrote it. The message text is never shown here (privacy policy). */
  z.object({
    kind: z.enum(["message", "review"]),
    id: idSchema,
    author: z.object({ id: idSchema, username: z.string() }),
  }),
]);
export type ReviewTarget = z.infer<typeof reviewTargetSchema>;

export const adminReviewItemSchema = z.object({
  id: idSchema,
  source: z.enum(REPORT_SOURCES),
  targetType: z.enum(REPORT_TARGETS),
  targetId: idSchema,
  /** The reason the member picked, or the AI check's main finding. */
  reason: z.enum(REPORT_REASONS),
  /** The AI's reading of what kind of problem it really is. Null when the AI was off. */
  aiReason: z.enum(REPORT_REASONS).nullable(),
  urgency: z.enum(REPORT_URGENCIES).nullable(),
  aiSummary: z.string().max(REVIEW_SUMMARY_MAX).nullable(),
  /** The member's own note. Null for AI flags. */
  details: z.string().nullable(),
  status: z.enum(REPORT_STATUSES),
  /** Null for AI flags. */
  reporter: z.object({ id: idSchema, username: z.string() }).nullable(),
  target: reviewTargetSchema.nullable(),
  /** Other open reports about the same thing, so a pile up is visible. */
  otherOpenReports: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  handledAt: isoDateTimeSchema.nullable(),
  resolutionNote: z.string().nullable(),
});
export type AdminReviewItem = z.infer<typeof adminReviewItemSchema>;

export const adminReviewPageSchema = pageSchema(adminReviewItemSchema).extend({
  /** Open items in total and how many of them are high, for the menu badge. */
  openCount: z.number().int().nonnegative(),
  openHighCount: z.number().int().nonnegative(),
});
export type AdminReviewPage = z.infer<typeof adminReviewPageSchema>;

/**
 * POST /v1/admin/review/:id/action. Hiding or removing works only for a listing. Every open report about the same
 * thing is closed with it.
 */
/** `refund_buyer` and `release_seller` work only for a disputed order (D-044) and use the existing support moves. */
export const REVIEW_ACTIONS = [
  "hide_listing",
  "remove_listing",
  "refund_buyer",
  "release_seller",
  "dismiss",
  "handled",
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
export const adminReviewActionInputSchema = z.object({
  action: z.enum(REVIEW_ACTIONS),
  note: z.string().trim().max(500).optional(),
});
