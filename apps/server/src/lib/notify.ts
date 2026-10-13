import { notificationPreferences, notifications, pushTokens, userSettings } from "@vinty/db";
import {
  type AppNotification,
  HIGH_PRIORITY_NOTIFICATION_TYPES,
  type Locale,
  NOTIFICATION_DEFAULT_ENABLED,
  type NotificationType,
} from "@vinty/shared";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { loadSellerSummaries } from "./discovery.js";
import type { PushMessage } from "./push.js";

type App = Pick<FastifyInstance, "db" | "storage" | "realtime" | "pusher" | "log">;

/**
 * Types that are written for push bookkeeping (the daily limit counts them) but never shown in the Notifications
 * tab or counted in its red dot: new messages already live in the Messages tab.
 */
export const INBOX_HIDDEN_TYPES = ["new_message"] as const satisfies readonly NotificationType[];

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  listingId?: string | null;
  orderId?: string | null;
  conversationId?: string | null;
  data?: Record<string, unknown>;
  /** While the earlier one is unread, further ones for the same chat raise its `data.count` instead of adding a row. */
  groupByConversation?: boolean;
  /** Title and body for the push in the person's language. Null or missing means no push for this type. */
  push?: (locale: Locale) => { title: string; body: string } | null;
  /** Extra values for the push `data` (the type and the ids are always there). */
  pushData?: Record<string, string>;
};

/** The notification as the Notifications tab draws it. */
export async function presentNotifications(
  app: Pick<App, "db" | "storage">,
  rows: (typeof notifications.$inferSelect)[],
): Promise<AppNotification[]> {
  const actors = await loadSellerSummaries(app, [
    ...new Set(rows.flatMap((r) => (r.actorId ? [r.actorId] : []))),
  ]);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    data: (r.data ?? {}) as Record<string, unknown>,
    listingId: r.listingId,
    orderId: r.orderId,
    conversationId: r.conversationId,
    actor: r.actorId ? (actors.get(r.actorId) ?? null) : null,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Records a notification for someone, tells their open app over the socket and sends a push when the person's
 * settings allow it. Returns whether a push went out.
 */
export async function notifyUser(app: App, input: NotifyInput): Promise<{ id: string; pushed: boolean }> {
  const now = new Date();
  let row: typeof notifications.$inferSelect | undefined;

  if (input.groupByConversation && input.conversationId) {
    const [open] = await app.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.type, input.type),
          eq(notifications.conversationId, input.conversationId),
          isNull(notifications.readAt),
        ),
      )
      .limit(1);
    if (open) {
      const previous = Number((open.data as { count?: number }).count ?? 1);
      [row] = await app.db
        .update(notifications)
        .set({
          actorId: input.actorId ?? null,
          data: { ...input.data, count: previous + 1 },
          createdAt: now,
        })
        .where(eq(notifications.id, open.id))
        .returning();
    }
  }
  if (!row) {
    [row] = await app.db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        actorId: input.actorId ?? null,
        listingId: input.listingId ?? null,
        orderId: input.orderId ?? null,
        conversationId: input.conversationId ?? null,
        data: { ...input.data, ...(input.groupByConversation ? { count: 1 } : {}) },
        createdAt: now,
      })
      .returning();
  }
  if (!row) throw new Error("Notification was not saved");

  if (!(INBOX_HIDDEN_TYPES as readonly string[]).includes(input.type)) {
    const [notification] = await presentNotifications(app, [row]);
    if (notification) app.realtime.toUser(input.userId).emit("notification:new", { notification });
  }

  const pushed = input.push ? await deliverPush(app, row, input) : false;
  return { id: row.id, pushed };
}

/** Why a push would not go: the person's own switches and limit, or no phone to send to. */
export async function deliverPush(
  app: App,
  row: typeof notifications.$inferSelect,
  input: Pick<NotifyInput, "push" | "pushData">,
): Promise<boolean> {
  const { userId, type } = row;
  const [settings] = await app.db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (settings && !settings.pushEnabled) return false;

  const [preference] = await app.db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.type, type),
        eq(notificationPreferences.channel, "push"),
      ),
    )
    .limit(1);
  if ((preference?.enabled ?? NOTIFICATION_DEFAULT_ENABLED) === false) return false;

  const isHigh = (HIGH_PRIORITY_NOTIFICATION_TYPES as readonly string[]).includes(type);
  const limit = settings?.pushDailyLimit ?? null;
  if (!isHigh && limit !== null) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [used] = await app.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), gt(notifications.pushedAt, since)));
    if ((used?.n ?? 0) >= limit) return false;
  }

  const tokens = await app.db
    .select()
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), isNull(pushTokens.revokedAt)));
  if (tokens.length === 0) return false;

  const locale: Locale = settings?.language ?? tokens[0]?.locale ?? "en";
  const content = input.push?.(locale);
  if (!content) return false;

  const data: Record<string, string> = { type, ...input.pushData };
  if (row.listingId) data.listingId = row.listingId;
  if (row.orderId) data.orderId = row.orderId;
  if (row.conversationId) data.conversationId = row.conversationId;
  const messages: PushMessage[] = tokens.map((t) => ({
    to: t.token,
    title: content.title,
    body: content.body,
    data,
    priority: isHigh ? "high" : "normal",
  }));

  let results: Awaited<ReturnType<App["pusher"]["send"]>>;
  try {
    results = await app.pusher.send(messages);
  } catch (err) {
    app.log.warn({ err }, "push could not be sent");
    return false;
  }
  const dead = tokens.filter((_, i) => {
    const r = results[i];
    return r && !r.ok && r.deviceGone;
  });
  if (dead.length > 0) {
    await app.db
      .update(pushTokens)
      .set({ revokedAt: new Date() })
      .where(
        inArray(
          pushTokens.id,
          dead.map((t) => t.id),
        ),
      );
  }
  const delivered = results.some((r) => r.ok);
  if (delivered) {
    await app.db.update(notifications).set({ pushedAt: new Date() }).where(eq(notifications.id, row.id));
  }
  return delivered;
}
