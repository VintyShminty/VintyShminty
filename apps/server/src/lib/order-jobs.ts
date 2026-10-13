import { listings, notifications, offers, orderItems, orders, reviews } from "@vinty/db";
import { and, eq, gt, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { notifyEvent } from "./event-notify.js";
import { expireOffer } from "./offers.js";
import { SYSTEM_ACTOR, transitionOrder } from "./orders.js";
import { DAY_MS } from "./settings.js";
import { broadcastListingUpdated } from "./thread.js";

type App = FastifyInstance;

export type JobResult = {
  offersExpired: number;
  acceptedOffersExpired: number;
  unpaidCancelled: number;
  reservationsReleased: number;
  unshippedCancelled: number;
  pretendDelivered: number;
  autoCompleted: number;
  reviewReminders: number;
};

const BATCH = 100;
/** A review reminder goes out two days after completion, and not for sales older than a week. */
const REMINDER_AFTER_MS = 2 * DAY_MS;
const REMINDER_UNTIL_MS = 7 * DAY_MS;

/** Pretend delivery delay in seconds: the env value, or 45 in development, or off. */
export function simulatedDeliverySeconds(app: Pick<App, "env">): number {
  const { SIMULATED_DELIVERY_SECONDS, NODE_ENV } = app.env;
  return SIMULATED_DELIVERY_SECONDS ?? (NODE_ENV === "development" ? 45 : 0);
}

/** Runs one step on many rows. One order failing is logged and never stops the rest. */
async function each<T>(app: App, ids: T[], what: string, run: (id: T) => Promise<boolean | undefined>) {
  let done = 0;
  for (const id of ids) {
    try {
      if (await run(id)) done += 1;
    } catch (err) {
      app.log.error({ err, id }, `job step failed: ${what}`);
    }
  }
  return done;
}

/**
 * The background work of api.md: expire offers, release items held for checkout, cancel paid orders that were not
 * shipped, complete delivered orders, the pretend delivery, and the review reminders. Safe to run twice at once:
 * every step locks the row it changes and checks again.
 */
export async function runOrderJobs(app: App, now = new Date()): Promise<JobResult> {
  const result: JobResult = {
    offersExpired: 0,
    acceptedOffersExpired: 0,
    unpaidCancelled: 0,
    reservationsReleased: 0,
    unshippedCancelled: 0,
    pretendDelivered: 0,
    autoCompleted: 0,
    reviewReminders: 0,
  };
  const { db } = app;

  const pending = await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.status, "pending"), lte(offers.expiresAt, now)))
    .limit(BATCH);
  result.offersExpired = await each(app, pending, "expire offer", (o) => expireOffer(app, o.id, now));

  const accepted = await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.status, "accepted"), lte(offers.expiresAt, now)))
    .limit(BATCH);
  result.acceptedOffersExpired = await each(app, accepted, "expire accepted offer", (o) =>
    expireOffer(app, o.id, now),
  );

  const unpaid = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lte(orders.payByAt, now)))
    .limit(BATCH);
  result.unpaidCancelled = await each(app, unpaid, "cancel unpaid order", async (o) => {
    await transitionOrder(app, o.id, "cancel", SYSTEM_ACTOR, { cancelReason: "payment_expired", now });
    return true;
  });

  // An item held for a buyer whose time ran out and who has no order waiting.
  const stale = await db
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(
        eq(listings.status, "reserved"),
        isNotNull(listings.reservedForUserId),
        lte(listings.reservedUntil, now),
        sql`not exists (select 1 from ${orderItems} join ${orders} on ${orders.id} = ${orderItems.orderId} where ${orderItems.listingId} = ${listings.id} and ${orders.status} = 'pending_payment')`,
      ),
    )
    .limit(BATCH);
  if (stale.length > 0) {
    const released = await db
      .update(listings)
      .set({ status: "active", reservedForUserId: null, reservedUntil: null })
      .where(
        and(
          inArray(
            listings.id,
            stale.map((l) => l.id),
          ),
          eq(listings.status, "reserved"),
          lte(listings.reservedUntil, now),
        ),
      )
      .returning({ id: listings.id });
    result.reservationsReleased = released.length;
    await broadcastListingUpdated(
      app,
      released.map((l) => l.id),
    );
  }

  const unshipped = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "paid"), lte(orders.shipByAt, now)))
    .limit(BATCH);
  result.unshippedCancelled = await each(app, unshipped, "cancel unshipped order", async (o) => {
    await transitionOrder(app, o.id, "cancel", SYSTEM_ACTOR, { cancelReason: "shipping_timeout", now });
    return true;
  });

  const delay = simulatedDeliverySeconds(app);
  if (delay > 0) {
    const shipped = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.status, "shipped"), lte(orders.shippedAt, new Date(now.getTime() - delay * 1000))))
      .limit(BATCH);
    result.pretendDelivered = await each(app, shipped, "pretend delivery", async (o) => {
      await transitionOrder(app, o.id, "deliver", SYSTEM_ACTOR, { now });
      return true;
    });
  }

  const delivered = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "delivered"), lte(orders.autoCompleteAt, now)))
    .limit(BATCH);
  result.autoCompleted = await each(app, delivered, "auto complete", async (o) => {
    await transitionOrder(app, o.id, "auto_complete", SYSTEM_ACTOR, { now });
    return true;
  });

  const recent = await db
    .select({
      o: orders,
      title: sql<string>`(select oi.title_snapshot from order_items oi where oi.order_id = "orders"."id" order by oi.created_at, oi.id limit 1)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "completed"),
        lte(orders.completedAt, new Date(now.getTime() - REMINDER_AFTER_MS)),
        gt(orders.completedAt, new Date(now.getTime() - REMINDER_UNTIL_MS)),
      ),
    )
    .limit(BATCH);
  result.reviewReminders = await each(app, recent, "review reminder", async ({ o, title }) => {
    let sent = false;
    for (const userId of [o.buyerId, o.sellerId]) {
      const [left] = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(eq(reviews.orderId, o.id), eq(reviews.reviewerId, userId), eq(reviews.isAutomatic, false)))
        .limit(1);
      if (left) continue;
      const [already] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.orderId, o.id),
            eq(notifications.type, "review_reminder"),
          ),
        )
        .limit(1);
      if (already) continue;
      await notifyEvent(app, {
        userId,
        type: "review_reminder",
        orderId: o.id,
        conversationId: o.conversationId,
        data: { orderNumber: o.orderNumber, title, role: userId === o.buyerId ? "buyer" : "seller" },
      });
      sent = true;
    }
    return sent;
  });

  return result;
}
