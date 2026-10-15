import {
  REPORT_REASONS,
  REPORT_SOURCES,
  REPORT_STATUSES,
  REPORT_TARGETS,
  REPORT_URGENCIES,
} from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, pk, ts, updatedAt } from "./_helpers.js";
import { users } from "./auth.js";
import { conversations } from "./conversations.js";
import { listings } from "./listings.js";
import { orders } from "./orders.js";
import { notificationTypeEnum } from "./people.js";

export const reportTargetEnum = pgEnum("report_target", REPORT_TARGETS);
export const reportReasonEnum = pgEnum("report_reason", REPORT_REASONS);
export const reportStatusEnum = pgEnum("report_status", REPORT_STATUSES);
export const reportSourceEnum = pgEnum("report_source", REPORT_SOURCES);
export const reportUrgencyEnum = pgEnum("report_urgency", REPORT_URGENCIES);

/**
 * In app notifications (Inbox, Notifications tab). Text is not stored.
 * The app turns `type` plus `data` into a sentence in the user's language, so Hebrew and English both work.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    /** Values used to fill the sentence, such as the item title or an amount. */
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    readAt: ts("read_at"),
    /** When a push was sent for it. Counting these per day enforces the user's daily push limit. */
    pushedAt: ts("pushed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_pushed_idx").on(t.userId, t.pushedAt).where(sql`${t.pushedAt} is not null`),
    index("notifications_user_idx").on(t.userId, t.createdAt.desc()),
    index("notifications_unread_idx").on(t.userId).where(sql`${t.readAt} is null`),
  ],
);

/**
 * One generic table for reports. The target is a type plus an id. No foreign key, so a report outlives its target.
 * D-038: the admin Review list also holds the AI listing check's flags (`source` 'ai_check', no reporter). The AI only
 * fills `ai_reason`, `urgency` and `ai_summary` to sort and describe, it never changes a listing or a person.
 */
export const reports = pgTable(
  "reports",
  {
    id: pk(),
    /** Null for an AI check flag. */
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "cascade" }),
    source: reportSourceEnum("source").notNull().default("member"),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    /** The AI's own reading of the kind of problem. Null until it has looked, or when the AI is off. */
    aiReason: reportReasonEnum("ai_reason"),
    /** How soon someone should look. Null until the AI has sorted it, those come after high, normal and low. */
    urgency: reportUrgencyEnum("urgency"),
    /** One plain sentence for the admin. */
    aiSummary: text("ai_summary"),
    status: reportStatusEnum("status").notNull().default("open"),
    handledById: uuid("handled_by_id").references(() => users.id, { onDelete: "set null" }),
    handledAt: ts("handled_at"),
    resolutionNote: text("resolution_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("reports_queue_idx").on(t.status, t.createdAt),
    index("reports_review_idx").on(t.status, t.urgency, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
    check("reports_details_length", sql`${t.details} is null or char_length(${t.details}) <= 2000`),
    check("reports_ai_summary_length", sql`${t.aiSummary} is null or char_length(${t.aiSummary}) <= 600`),
    check("reports_member_has_reporter", sql`${t.source} <> 'member' or ${t.reporterId} is not null`),
  ],
);

export const badgeDefinitions = pgTable("badge_definitions", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameHe: text("name_he").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionHe: text("description_he").notNull(),
  /** Lucide icon name. */
  icon: text("icon").notNull(),
  /** Progress needed to earn it, for example 10 sales. */
  target: integer("target").notNull().default(1),
  /** Shown on the profile as a trust pill (Frequent uploads, Speedy shipping). */
  showOnProfile: boolean("show_on_profile").notNull().default(false),
});

export const userBadges = pgTable(
  "user_badges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badgeDefinitions.id, { onDelete: "cascade" }),
    progress: integer("progress").notNull().default(0),
    earnedAt: ts("earned_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] }), index("user_badges_badge_idx").on(t.badgeId)],
);
