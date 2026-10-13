import { randomInt } from "node:crypto";
import {
  bundles,
  conversations,
  type Database,
  favourites,
  listings,
  orderEvents,
  orderItems,
  orders,
  payments,
  shipments,
} from "@vinty/db";
import {
  type ActorRole,
  addressSchema,
  canActorCancel,
  canActorTransition,
  cancelReasonFor,
  isWithinDisputeWindow,
  nextOrderStatus,
  type OrderCancelReason,
  type OrderDetail,
  type OrderEvent,
  type OrderRow,
  type OrderStatus,
  orderActionsFor,
  type SystemMessageEvent,
} from "@vinty/shared";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { loadSellerSummaries } from "./discovery.js";
import { ApiError } from "./errors.js";
import { notifyEvent } from "./event-notify.js";
import { refreshSellerCounts } from "./listings.js";
import { notifyReferralRewarded, rewardReferralOnCompletion } from "./referrals.js";
import { leaveAutomaticReview, presentReviews, reviewsOfOrder } from "./reviews.js";
import { DAY_MS, HOUR_MS, loadOrderSettings, type OrderSettings } from "./settings.js";
import {
  broadcastListingUpdated,
  broadcastNewMessages,
  type ConversationRecord,
  insertSystemMessage,
  type MessageRecord,
  type OrderRecord,
} from "./thread.js";
import { creditSale, releaseSale, voidSale } from "./wallet.js";

type Db = NonNullable<Database["db"]>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type App = FastifyInstance;

export type Actor = { role: ActorRole; userId: string | null };
export const SYSTEM_ACTOR: Actor = { role: "system", userId: null };

export type TransitionOptions = {
  note?: string;
  cancelReason?: OrderCancelReason;
  now?: Date;
};

const invalidMove = (message: string) => new ApiError(409, "invalid_transition", message);

/** The order, if this person is the buyer or the seller. A seller only sees it once it is paid. Anyone else gets 404. */
export async function requireOrderParty(
  db: Pick<Db, "select">,
  orderId: string,
  userId: string,
): Promise<OrderRecord> {
  const [row] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        or(eq(orders.buyerId, userId), and(eq(orders.sellerId, userId), sql`${orders.paidAt} is not null`)),
      ),
    )
    .limit(1);
  if (!row) throw ApiError.notFound();
  return row;
}

const fakeTrackingCode = () => `SIM${String(randomInt(0, 10_000_000_000)).padStart(10, "0")}`;

type ItemRecord = typeof orderItems.$inferSelect;

const DIVIDER_FOR: Partial<Record<OrderEvent, SystemMessageEvent>> = {
  pay: "order_paid",
  ship: "order_shipped",
  deliver: "order_delivered",
  confirm_received: "order_completed",
  auto_complete: "order_completed",
  release: "order_completed",
  cancel: "order_cancelled",
  open_dispute: "order_disputed",
  refund: "order_refunded",
};

type Run = {
  tx: Tx;
  app: App;
  order: OrderRecord;
  items: ItemRecord[];
  conversation: ConversationRecord | null;
  actor: Actor;
  opts: TransitionOptions;
  now: Date;
  settings: OrderSettings;
  /** Dividers written in this transaction, broadcast after it commits. */
  written: MessageRecord[];
  /** Things to do after the commit: tell the app, notify, push. */
  after: (() => Promise<void>)[];
  listingsChanged: Set<string>;
};

const itemTitle = (items: ItemRecord[]) => items[0]?.titleSnapshot ?? "";

function orderData(run: Run, extra: Record<string, unknown> = {}) {
  return {
    orderNumber: run.order.orderNumber,
    title: itemTitle(run.items),
    itemCount: run.items.length,
    ...extra,
  };
}

/** Puts the items back on sale. Only listings still held or sold by this very order are touched. */
async function putItemsBackOnSale(run: Run) {
  const ids = run.items.flatMap((i) => (i.listingId ? [i.listingId] : []));
  if (ids.length === 0) return;
  const back = await run.tx
    .update(listings)
    .set({ status: "active", reservedForUserId: null, reservedUntil: null, soldAt: null })
    .where(
      and(
        inArray(listings.id, ids),
        or(
          and(eq(listings.status, "reserved"), eq(listings.reservedForUserId, run.order.buyerId)),
          eq(listings.status, "sold"),
        ),
      ),
    )
    .returning({ id: listings.id });
  for (const { id } of back) run.listingsChanged.add(id);
  if (run.order.bundleId) {
    await run.tx.update(bundles).set({ status: "open" }).where(eq(bundles.id, run.order.bundleId));
  }
}

/** The work each step does besides moving the status. Everything here is in the same transaction as the move. */
async function applyStep(
  run: Run,
  event: OrderEvent,
  to: OrderStatus,
  actor: Actor,
): Promise<Partial<typeof orders.$inferInsert>> {
  const { tx, order, now, settings } = run;
  const patch: Partial<typeof orders.$inferInsert> = { status: to };

  switch (event) {
    case "pay": {
      const listingIds = run.items.flatMap((i) => (i.listingId ? [i.listingId] : []));
      const held = await tx
        .select({ id: listings.id, status: listings.status, reservedForUserId: listings.reservedForUserId })
        .from(listings)
        .where(inArray(listings.id, listingIds))
        .orderBy(listings.id)
        .for("update");
      if (
        held.length !== listingIds.length ||
        held.some((l) => l.status !== "reserved" || l.reservedForUserId !== order.buyerId)
      ) {
        throw new ApiError(409, "listing_unavailable", "This item is no longer held for you");
      }
      await tx
        .update(listings)
        .set({ status: "sold", soldAt: now, reservedForUserId: null, reservedUntil: null })
        .where(inArray(listings.id, listingIds));
      for (const id of listingIds) run.listingsChanged.add(id);
      // SIMULATED: no card is asked for and no money moves. The row says so.
      await tx.insert(payments).values({
        orderId: order.id,
        provider: "simulated",
        status: "succeeded",
        amountMinor: order.totalMinor,
        currency: order.currency,
        method: "simulated",
        paidAt: now,
      });
      await creditSale(tx, {
        sellerId: order.sellerId,
        orderId: order.id,
        amountMinor: order.sellerEarningsMinor,
        currency: order.currency,
        description: itemTitle(run.items),
      });
      if (order.bundleId)
        await tx.update(bundles).set({ status: "ordered" }).where(eq(bundles.id, order.bundleId));
      Object.assign(patch, {
        paidAt: now,
        payByAt: null,
        paymentProvider: "simulated",
        shipByAt: new Date(now.getTime() + settings.shipByDays * DAY_MS),
      });
      run.after.push(async () => {
        await notifyEvent(run.app, {
          userId: order.sellerId,
          type: "order_paid",
          actorId: order.buyerId,
          orderId: order.id,
          listingId: run.items[0]?.listingId ?? null,
          conversationId: order.conversationId,
          data: orderData(run, {
            amountMinor: order.sellerEarningsMinor,
            currency: order.currency,
          }),
        });
        await notifyFavouriters(run, listingIds);
      });
      break;
    }

    case "ship": {
      // SIMULATED: a fake tracking code, no carrier is contacted.
      const trackingCode = fakeTrackingCode();
      await tx.insert(shipments).values({
        orderId: order.id,
        provider: "simulated",
        status: "in_transit",
        carrier: "Simulated Post",
        trackingCode,
        parcelSizeId: order.parcelSizeId,
        shippedAt: now,
      });
      Object.assign(patch, { shippedAt: now, shippingProvider: "simulated", shipByAt: null });
      run.after.push(() =>
        notifyEvent(run.app, {
          userId: order.buyerId,
          type: "order_shipped",
          actorId: order.sellerId,
          orderId: order.id,
          listingId: run.items[0]?.listingId ?? null,
          conversationId: order.conversationId,
          data: orderData(run, { trackingCode }),
        }),
      );
      break;
    }

    case "deliver": {
      await tx
        .update(shipments)
        .set({ status: "delivered", deliveredAt: now })
        .where(eq(shipments.orderId, order.id));
      Object.assign(patch, {
        deliveredAt: now,
        autoCompleteAt: new Date(now.getTime() + settings.autoCompleteHoursAfterDelivery * HOUR_MS),
      });
      // The buyer who confirms a parcel that had no delivered step does not need to be told about it.
      if (actor.role !== "buyer") {
        run.after.push(() =>
          notifyEvent(run.app, {
            userId: order.buyerId,
            type: "order_delivered",
            orderId: order.id,
            listingId: run.items[0]?.listingId ?? null,
            conversationId: order.conversationId,
            data: orderData(run),
          }),
        );
      }
      break;
    }

    case "confirm_received":
    case "auto_complete":
    case "release": {
      const released = await releaseSale(tx, order.sellerId, order.id, now);
      Object.assign(patch, { completedAt: now, autoCompleteAt: null });
      // A sale that completes by itself or by the buyer leaves a five star automatic review.
      const withReview = event !== "release";
      let leftReview = false;
      if (withReview) leftReview = await leaveAutomaticReview(tx, order, settings.autoReviewRating);
      if (leftReview && run.conversation) {
        run.written.push(
          await insertSystemMessage(tx, {
            conversationId: run.conversation.id,
            event: "review_auto_left",
            orderId: order.id,
            payload: orderData(run, { rating: settings.autoReviewRating }),
            at: new Date(now.getTime() + 1),
          }),
        );
      }
      // A friend's first big enough order pays out the invite for both sides (Invite friends).
      const reward = await rewardReferralOnCompletion(tx, order, settings, now);
      run.after.push(async () => {
        const common = {
          orderId: order.id,
          listingId: run.items[0]?.listingId ?? null,
          conversationId: order.conversationId,
        };
        await notifyEvent(run.app, {
          userId: order.sellerId,
          type: "order_completed",
          ...common,
          data: orderData(run, { role: "seller" }),
        });
        if (released > 0) {
          await notifyEvent(run.app, {
            userId: order.sellerId,
            type: "balance_released",
            orderId: order.id,
            data: orderData(run, { amountMinor: released, currency: order.currency }),
          });
        }
        await notifyEvent(run.app, {
          userId: order.buyerId,
          type: "order_completed",
          ...common,
          data: orderData(run, { role: "buyer" }),
        });
        if (reward) {
          await notifyReferralRewarded(run.app, reward, settings.referralRewardMinor, order.currency);
        }
      });
      break;
    }

    case "cancel": {
      const wasPaid = order.paidAt !== null;
      await putItemsBackOnSale(run);
      if (wasPaid) {
        await tx
          .update(payments)
          .set({ status: "refunded", refundedAt: now })
          .where(and(eq(payments.orderId, order.id), eq(payments.status, "succeeded")));
        await voidSale(tx, order.sellerId, order.id);
      }
      const reason = run.opts.cancelReason ?? cancelReasonFor(actor.role);
      Object.assign(patch, {
        cancelReason: reason,
        cancelledById: actor.userId,
        cancelledAt: now,
        payByAt: null,
        shipByAt: null,
      });
      const targets =
        actor.role === "buyer"
          ? [order.sellerId]
          : actor.role === "seller"
            ? [order.buyerId]
            : [order.buyerId, order.sellerId];
      // A seller sees nothing of an order that was never paid.
      const visible = targets.filter((id) => wasPaid || id === order.buyerId);
      run.after.push(async () => {
        for (const userId of visible) {
          await notifyEvent(run.app, {
            userId,
            type: "order_cancelled",
            ...(actor.userId ? { actorId: actor.userId } : {}),
            orderId: order.id,
            listingId: run.items[0]?.listingId ?? null,
            conversationId: order.conversationId,
            data: orderData(run, { reason, byRole: actor.role }),
          });
        }
      });
      break;
    }

    case "open_dispute":
      Object.assign(patch, { autoCompleteAt: null });
      break;

    case "refund": {
      await tx
        .update(payments)
        .set({ status: "refunded", refundedAt: now })
        .where(and(eq(payments.orderId, order.id), eq(payments.status, "succeeded")));
      await voidSale(tx, order.sellerId, order.id);
      await putItemsBackOnSale(run);
      run.after.push(async () => {
        for (const userId of [order.buyerId, order.sellerId]) {
          await notifyEvent(run.app, {
            userId,
            type: "order_cancelled",
            orderId: order.id,
            listingId: run.items[0]?.listingId ?? null,
            conversationId: order.conversationId,
            data: orderData(run, { reason: "refunded", byRole: "admin" }),
          });
        }
      });
      break;
    }

    default:
      break;
  }
  return patch;
}

/** People who hearted a sold item hear that it is gone. */
async function notifyFavouriters(run: Run, listingIds: string[]) {
  const rows = await run.app.db
    .select({ userId: favourites.userId, listingId: favourites.listingId })
    .from(favourites)
    .where(
      and(
        inArray(favourites.listingId, listingIds),
        ne(favourites.userId, run.order.buyerId),
        ne(favourites.userId, run.order.sellerId),
      ),
    )
    .limit(500);
  const titles = new Map(run.items.map((i) => [i.listingId, i.titleSnapshot]));
  for (const row of rows) {
    await notifyEvent(run.app, {
      userId: row.userId,
      type: "favourite_sold",
      listingId: row.listingId,
      data: { title: titles.get(row.listingId) ?? "" },
    });
  }
}

/**
 * The one way an order moves. It checks the state machine and who may do it, runs the work of the step inside a
 * transaction (timeline row, divider in the thread, money, listing status), and afterwards tells both people.
 * `confirm_received` on a shipped order records the delivered step first, as api.md says.
 */
export async function transitionOrder(
  app: App,
  orderId: string,
  event: OrderEvent,
  actor: Actor,
  opts: TransitionOptions = {},
): Promise<OrderRecord> {
  const now = opts.now ?? new Date();
  const settings = await loadOrderSettings(app.db);

  const run = await app.db.transaction(async (tx) => {
    const [locked] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!locked) throw ApiError.notFound();
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(orderItems.createdAt, orderItems.id);
    const [conversation] = locked.conversationId
      ? await tx.select().from(conversations).where(eq(conversations.id, locked.conversationId)).limit(1)
      : [];
    const state: Run = {
      tx,
      app,
      order: locked,
      items,
      conversation: conversation ?? null,
      actor,
      opts,
      now,
      settings,
      written: [],
      after: [],
      listingsChanged: new Set(),
    };

    const steps: { event: OrderEvent; actor: Actor }[] =
      event === "confirm_received" && locked.status === "shipped"
        ? [
            { event: "deliver", actor },
            { event: "confirm_received", actor },
          ]
        : [{ event, actor }];

    let tick = 0;
    for (const step of steps) {
      const from = state.order.status;
      const to = nextOrderStatus(from, step.event);
      if (!to || !canActorTransition(from, step.event, step.actor.role)) {
        throw invalidMove(`An order that is ${from.replaceAll("_", " ")} cannot do that`);
      }
      if (step.event === "cancel" && !canActorCancel(from, step.actor.role)) {
        throw invalidMove("This order can no longer be cancelled");
      }
      if (step.event === "open_dispute" && !isWithinDisputeWindow(state.order.deliveredAt, now)) {
        throw invalidMove("The time to report a problem has passed");
      }
      const patch = await applyStep(state, step.event, to, step.actor);
      const [updated] = await tx.update(orders).set(patch).where(eq(orders.id, orderId)).returning();
      if (!updated) throw new Error("Order was not updated");
      state.order = updated;

      await tx.insert(orderEvents).values({
        orderId,
        event: step.event,
        fromStatus: from,
        toStatus: to,
        actorId: step.actor.userId,
        actorRole: step.actor.role,
        note: opts.note ?? null,
        // Written a millisecond apart so a two step move keeps its order in the timeline.
        createdAt: new Date(now.getTime() + tick),
      });

      const divider = DIVIDER_FOR[step.event];
      // A buyer who taps "I received it" on a parcel in transit sees one "Order completed" divider, not two.
      const skipDelivered = step.event === "deliver" && steps.length > 1;
      if (divider && state.conversation && !skipDelivered) {
        state.written.push(
          await insertSystemMessage(tx, {
            conversationId: state.conversation.id,
            event: divider,
            orderId,
            payload: orderData(state, {
              ...(step.event === "cancel" ? { reason: updated.cancelReason } : {}),
              ...(step.event === "open_dispute" && opts.note ? { details: opts.note } : {}),
            }),
            at: new Date(now.getTime() + tick),
          }),
        );
      }
      tick += 1;
    }
    return state;
  });

  try {
    const sellerIds = [run.order.sellerId];
    for (const id of sellerIds) await refreshSellerCounts(app.db, id);
    if (run.conversation && run.written.length > 0) {
      await broadcastNewMessages(app, run.conversation, run.written);
    }
    if (run.listingsChanged.size > 0) {
      await broadcastListingUpdated(app, [...run.listingsChanged], [run.order.buyerId]);
    }
    for (const userId of [run.order.buyerId, run.order.sellerId]) {
      // The seller learns of an order when it is paid, not before.
      if (userId === run.order.sellerId && !run.order.paidAt) continue;
      app.realtime.toUser(userId).emit("order:updated", {
        orderId,
        status: run.order.status,
        conversationId: run.order.conversationId,
      });
    }
    for (const task of run.after) await task();
  } catch (err) {
    app.log.error({ err }, "could not announce an order change");
  }
  return run.order;
}

// ---- Presenting ----

const summaryFor = async (app: App, ids: string[]) => loadSellerSummaries(app, ids);

type ListRow = {
  o: OrderRecord;
  firstTitle: string | null;
  firstKey: string | null;
  itemCount: number;
  cursorTs: string;
};

// The subselects name the orders table in full: a select from one table leaves column names unqualified.
export const orderRowFields = {
  o: orders,
  firstTitle: sql<
    string | null
  >`(select oi.title_snapshot from order_items oi where oi.order_id = "orders"."id" order by oi.created_at, oi.id limit 1)`,
  firstKey: sql<
    string | null
  >`(select oi.photo_key_snapshot from order_items oi where oi.order_id = "orders"."id" order by oi.created_at, oi.id limit 1)`,
  itemCount: sql<number>`(select count(*)::int from order_items oi where oi.order_id = "orders"."id")`,
};

export async function presentOrderRows(app: App, userId: string, rows: ListRow[]): Promise<OrderRow[]> {
  const others = await summaryFor(app, [
    ...new Set(rows.map((r) => (r.o.buyerId === userId ? r.o.sellerId : r.o.buyerId))),
  ]);
  return rows.map(({ o, firstTitle, firstKey, itemCount }) => {
    const role = o.buyerId === userId ? "buyer" : "seller";
    const otherId = role === "buyer" ? o.sellerId : o.buyerId;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      role,
      status: o.status,
      otherUser: others.get(otherId) ?? {
        id: otherId,
        username: null,
        avatarUrl: null,
        ratingAverage: null,
        reviewCount: 0,
      },
      conversationId: o.conversationId,
      title: firstTitle ?? "",
      photoUrl: firstKey ? app.storage.publicUrl(firstKey) : null,
      itemCount,
      currency: o.currency,
      totalMinor: o.totalMinor,
      sellerEarningsMinor: role === "seller" ? o.sellerEarningsMinor : null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  });
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** One order in full for one of its two people. */
export async function presentOrderDetail(
  app: App,
  order: OrderRecord,
  viewerId: string,
  now = new Date(),
): Promise<OrderDetail> {
  const [items, [payment], [shipment], events, reviewRows, people] = await Promise.all([
    app.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(orderItems.createdAt, orderItems.id),
    app.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt))
      .limit(1),
    app.db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, order.id))
      .orderBy(desc(shipments.createdAt))
      .limit(1),
    app.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(orderEvents.createdAt, orderEvents.id),
    reviewsOfOrder(app.db, order.id),
    summaryFor(app, [order.buyerId, order.sellerId]),
  ]);
  const role = order.buyerId === viewerId ? "buyer" : "seller";
  const [row] = await presentOrderRows(app, viewerId, [
    {
      o: order,
      firstTitle: items[0]?.titleSnapshot ?? null,
      firstKey: items[0]?.photoKeySnapshot ?? null,
      itemCount: items.length,
      cursorTs: "",
    },
  ]);
  if (!row) throw new Error("Order could not be presented");
  const empty = (id: string) => ({
    id,
    username: null,
    avatarUrl: null,
    ratingAverage: null,
    reviewCount: 0,
  });

  const presentedReviews = await presentReviews(app, reviewRows);
  const mine = presentedReviews.find((r) => r.reviewer.id === viewerId) ?? null;
  const theirs = presentedReviews.find((r) => r.reviewer.id !== viewerId) ?? null;
  const address = addressSchema.omit({ id: true }).safeParse(order.shippingAddress);

  return {
    ...row,
    buyer: people.get(order.buyerId) ?? empty(order.buyerId),
    seller: people.get(order.sellerId) ?? empty(order.sellerId),
    offerId: order.offerId,
    bundleId: order.bundleId,
    items: items.map((i) => ({
      listingId: i.listingId,
      title: i.titleSnapshot,
      brand: i.brandSnapshot,
      size: i.sizeSnapshot,
      photoUrl: i.photoKeySnapshot ? app.storage.publicUrl(i.photoKeySnapshot) : null,
      priceMinor: i.priceMinor,
    })),
    itemsSubtotalMinor: order.itemsSubtotalMinor,
    bundleDiscountMinor: order.bundleDiscountMinor,
    buyerProtectionFeeMinor: order.buyerProtectionFeeMinor,
    shippingMinor: order.shippingMinor,
    voucherDiscountMinor: order.voucherDiscountMinor,
    deliveryMethod: order.deliveryMethod,
    shippingAddress: address.success ? address.data : null,
    payment: payment
      ? {
          provider: payment.provider,
          simulated: payment.provider === "simulated",
          status: payment.status,
          method: payment.method,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          paidAt: iso(payment.paidAt),
          refundedAt: iso(payment.refundedAt),
        }
      : null,
    shipment: shipment
      ? {
          provider: shipment.provider,
          simulated: shipment.provider === "simulated",
          status: shipment.status,
          carrier: shipment.carrier,
          trackingCode: shipment.trackingCode,
          shippedAt: iso(shipment.shippedAt),
          deliveredAt: iso(shipment.deliveredAt),
        }
      : null,
    timeline: events.map((e) => ({
      id: e.id,
      event: e.event,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorRole: e.actorRole,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
    cancelReason: order.cancelReason,
    payByAt: order.status === "pending_payment" ? iso(order.payByAt) : null,
    shipByAt: order.status === "paid" ? iso(order.shipByAt) : null,
    autoCompleteAt: iso(order.autoCompleteAt),
    paidAt: iso(order.paidAt),
    shippedAt: iso(order.shippedAt),
    deliveredAt: iso(order.deliveredAt),
    completedAt: iso(order.completedAt),
    cancelledAt: iso(order.cancelledAt),
    actions: orderActionsFor(order.status, role, order.deliveredAt, now),
    canReview: order.status === "completed" && (mine === null || mine.isAutomatic),
    reviews: { mine, theirs },
  };
}
