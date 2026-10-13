import { conversations, listings, offers, orders } from "@vinty/db";
import {
  canOfferActorTransition,
  canOfferTransition,
  type Offer,
  type OfferEvent,
  type OfferQuota,
  type OfferStatus,
  nextOfferStatus,
} from "@vinty/shared";
import { and, count, eq, gt, ne, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { notifyEvent } from "./event-notify.js";
import { ApiError } from "./errors.js";
import { isBlockedBetween, requireParty } from "./messaging.js";
import { DAY_MS, HOUR_MS, loadOrderSettings } from "./settings.js";
import {
  broadcastListingUpdated,
  broadcastNewMessages,
  broadcastOfferUpdated,
  type ConversationRecord,
  insertOfferMessage,
  insertSystemMessage,
  type MessageRecord,
  type OfferRecord,
} from "./thread.js";

type App = FastifyInstance;

/** True for a Postgres "duplicate key" error, also when the driver wrapped it. */
export const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export function presentOffer(row: OfferRecord): Offer {
  return {
    id: row.id,
    conversationId: row.conversationId,
    listingId: row.listingId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    offeredById: row.offeredById,
    parentOfferId: row.parentOfferId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    listingPriceMinor: row.listingPriceMinor,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    // An accepted offer holds the item for the buyer until it runs out.
    reservedUntil: row.status === "accepted" ? row.expiresAt.toISOString() : null,
  };
}

// ---- Quota ----

/** Offers a buyer sent in the last 24 hours. Counter offers from a seller do not count, a buyer's own counter does. */
export async function offerQuota(app: Pick<App, "db">, buyerId: string, now = new Date()): Promise<OfferQuota> {
  const settings = await loadOrderSettings(app.db);
  const rows = await app.db
    .select({ createdAt: offers.createdAt })
    .from(offers)
    .where(
      and(
        eq(offers.buyerId, buyerId),
        eq(offers.offeredById, buyerId),
        gt(offers.createdAt, new Date(now.getTime() - DAY_MS)),
      ),
    )
    .orderBy(offers.createdAt);
  const oldest = rows[0]?.createdAt;
  return {
    limit: settings.offerDailyLimit,
    remaining: Math.max(0, settings.offerDailyLimit - rows.length),
    resetsAt: new Date((oldest ?? now).getTime() + DAY_MS).toISOString(),
  };
}

type Tx = Parameters<Parameters<FastifyInstance["db"]["transaction"]>[0]>[0];

/** Inside a transaction: stops two offers of one person racing past the daily limit. */
async function lockBuyerQuota(tx: Tx, buyerId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`offer-quota:${buyerId}`}, 0))`);
}

async function assertQuota(tx: Tx, buyerId: string, limit: number, now: Date) {
  const rows = await tx
    .select({ createdAt: offers.createdAt })
    .from(offers)
    .where(
      and(
        eq(offers.buyerId, buyerId),
        eq(offers.offeredById, buyerId),
        gt(offers.createdAt, new Date(now.getTime() - DAY_MS)),
      ),
    )
    .orderBy(offers.createdAt);
  if (rows.length >= limit) {
    const resetsAt = new Date((rows[0]?.createdAt ?? now).getTime() + DAY_MS);
    throw new ApiError(
      429,
      "offer_limit_reached",
      "You have used all your offers for today",
      undefined,
      Math.max(1, Math.ceil((resetsAt.getTime() - now.getTime()) / 1000)),
      { resetsAt: resetsAt.toISOString() },
    );
  }
}

// ---- Sending ----

const TOO_HIGH = { amountMinor: "validation.offer.belowPrice" };

function checkAmount(amountMinor: number, listingPriceMinor: number | null) {
  if (amountMinor <= 0) throw ApiError.invalid("Offer more than zero", { amountMinor: "validation.offer.positive" });
  if (listingPriceMinor === null || amountMinor >= listingPriceMinor) {
    throw ApiError.invalid("An offer must be lower than the price", TOO_HIGH);
  }
}

async function requireOpenListing(db: App["db"], listingId: string) {
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing || listing.status !== "active") {
    throw new ApiError(409, "listing_unavailable", "This item is not available");
  }
  return listing;
}

/** The buyer sends an offer in a chat. */
export async function createOffer(
  app: App,
  userId: string,
  conversationId: string,
  amountMinor: number,
): Promise<Offer> {
  const conversation = await requireParty(app, conversationId, userId);
  if (conversation.buyerId !== userId) throw ApiError.forbidden("Only the buyer can make an offer");
  if (await isBlockedBetween(app, userId, conversation.sellerId)) {
    throw new ApiError(403, "blocked", "You cannot make an offer to this person");
  }
  const listing = await requireOpenListing(app.db, conversation.listingId);
  checkAmount(amountMinor, listing.priceMinor);
  const settings = await loadOrderSettings(app.db);
  const now = new Date();

  let created: { offer: OfferRecord; message: MessageRecord };
  try {
    created = await app.db.transaction(async (tx) => {
      await lockBuyerQuota(tx, userId);
      await assertQuota(tx, userId, settings.offerDailyLimit, now);
      const [pending] = await tx
        .select({ id: offers.id })
        .from(offers)
        .where(and(eq(offers.conversationId, conversationId), eq(offers.status, "pending")))
        .limit(1);
      if (pending) throw ApiError.conflict("There is already an offer waiting for an answer");
      const [offer] = await tx
        .insert(offers)
        .values({
          conversationId,
          listingId: listing.id,
          buyerId: conversation.buyerId,
          sellerId: conversation.sellerId,
          offeredById: userId,
          amountMinor,
          currency: listing.currency,
          listingPriceMinor: listing.priceMinor as number,
          expiresAt: new Date(now.getTime() + settings.offerExpiryHours * HOUR_MS),
          createdAt: now,
        })
        .returning();
      if (!offer) throw new Error("Offer was not saved");
      const message = await insertOfferMessage(tx, { conversationId, senderId: userId, offerId: offer.id, at: now });
      return { offer, message };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw ApiError.conflict("There is already an offer waiting for an answer");
    throw err;
  }

  await afterCommit(app, async () => {
    await broadcastNewMessages(app, conversation, [created.message]);
    await notifyEvent(app, {
      userId: conversation.sellerId,
      type: "new_offer",
      actorId: userId,
      listingId: listing.id,
      conversationId,
      data: offerData(created.offer, listing.title),
    });
  });
  return presentOffer(created.offer);
}

const offerData = (offer: OfferRecord, title: string) => ({
  offerId: offer.id,
  amountMinor: offer.amountMinor,
  currency: offer.currency,
  listingPriceMinor: offer.listingPriceMinor,
  title,
});

/** Broadcasts and notifications run after the commit. A failure here is logged and never undoes the change. */
async function afterCommit(app: Pick<App, "log">, run: () => Promise<void>) {
  try {
    await run();
  } catch (err) {
    app.log.error({ err }, "could not announce an offer change");
  }
}

// ---- Answering ----

const DIVIDER_FOR: Record<Exclude<OfferEvent, "expire"> | "expire", string> = {
  accept: "offer_accepted",
  decline: "offer_declined",
  counter: "offer_countered",
  withdraw: "offer_withdrawn",
  expire: "offer_expired",
};

type Answer = { event: Exclude<OfferEvent, "expire">; amountMinor?: number };

async function loadOffer(app: Pick<App, "db">, offerId: string, userId: string) {
  const [offer] = await app.db
    .select()
    .from(offers)
    .where(and(eq(offers.id, offerId), or(eq(offers.buyerId, userId), eq(offers.sellerId, userId))))
    .limit(1);
  if (!offer) throw ApiError.notFound();
  return offer;
}

/**
 * Accept, decline, counter or withdraw. The state machine decides what is allowed, the rest is the work each move
 * does: reserve the item, write the divider, open the counter bubble.
 */
export async function answerOffer(
  app: App,
  userId: string,
  offerId: string,
  answer: Answer,
): Promise<{ offer: Offer; counter: Offer | null }> {
  let offer = await loadOffer(app, offerId, userId);
  const now = new Date();

  // An unanswered offer past its time is expired on the spot, so the answer never races the background job.
  if (offer.status === "pending" && offer.expiresAt <= now) {
    await expireOffer(app, offer.id, now);
    throw new ApiError(409, "invalid_transition", "This offer has expired");
  }

  if (!canOfferTransition(offer.status, answer.event)) {
    throw new ApiError(409, "invalid_transition", `An offer that is ${offer.status} cannot be answered`);
  }
  const side = offer.offeredById === userId ? "offerer" : "recipient";
  if (!canOfferActorTransition(offer.status, answer.event, side)) {
    throw ApiError.forbidden(
      side === "offerer" ? "You cannot answer your own offer" : "Only the person who made the offer can take it back",
    );
  }
  const otherId = offer.buyerId === userId ? offer.sellerId : offer.buyerId;
  if ((answer.event === "accept" || answer.event === "counter") && (await isBlockedBetween(app, userId, otherId))) {
    throw new ApiError(403, "blocked", "You cannot answer this person");
  }
  const conversation = await requireParty(app, offer.conversationId, userId);
  const settings = await loadOrderSettings(app.db);

  const [listing] = await app.db.select().from(listings).where(eq(listings.id, offer.listingId)).limit(1);
  if (!listing) throw ApiError.notFound();
  if (answer.event === "counter") {
    checkAmount(answer.amountMinor ?? 0, listing.priceMinor);
    if (listing.status !== "active") throw new ApiError(409, "listing_unavailable", "This item is not available");
  }

  const nextStatus = nextOfferStatus(offer.status, answer.event) as OfferStatus;
  const messagesWritten: MessageRecord[] = [];
  let listingChanged = false;
  let counterOffer: OfferRecord | null = null;

  try {
    offer = await app.db.transaction(async (tx) => {
      // Lock the offer so two answers at once cannot both win.
      const [locked] = await tx.select().from(offers).where(eq(offers.id, offer.id)).for("update").limit(1);
      if (!locked || locked.status !== offer.status) {
        throw new ApiError(409, "invalid_transition", "This offer has already been answered");
      }
      const patch: Partial<typeof offers.$inferInsert> = { status: nextStatus, respondedAt: now };

      if (answer.event === "accept") {
        const [row] = await tx.select().from(listings).where(eq(listings.id, offer.listingId)).for("update").limit(1);
        const heldForBuyer = row?.status === "reserved" && row.reservedForUserId === offer.buyerId;
        if (!row || (row.status !== "active" && !heldForBuyer)) {
          throw new ApiError(409, "listing_unavailable", "This item is not available");
        }
        const holdUntil = new Date(now.getTime() + settings.acceptedOfferHoldHours * HOUR_MS);
        patch.expiresAt = holdUntil;
        await tx
          .update(listings)
          .set({ status: "reserved", reservedForUserId: offer.buyerId, reservedUntil: holdUntil })
          .where(eq(listings.id, offer.listingId));
        listingChanged = true;
      }

      if (answer.event === "counter") {
        // A buyer who counters a seller's counter is making an offer, so it counts towards the daily limit.
        if (userId === offer.buyerId) {
          await lockBuyerQuota(tx, userId);
          await assertQuota(tx, userId, settings.offerDailyLimit, now);
        }
      }

      const [updated] = await tx.update(offers).set(patch).where(eq(offers.id, offer.id)).returning();
      if (!updated) throw new Error("Offer was not updated");

      messagesWritten.push(
        await insertSystemMessage(tx, {
          conversationId: offer.conversationId,
          event: DIVIDER_FOR[answer.event] as "offer_accepted",
          payload: {
            offerId: offer.id,
            amountMinor: answer.event === "counter" ? answer.amountMinor : offer.amountMinor,
            currency: offer.currency,
            title: listing.title,
          },
          at: now,
        }),
      );

      if (answer.event === "counter") {
        const [created] = await tx
          .insert(offers)
          .values({
            conversationId: offer.conversationId,
            listingId: offer.listingId,
            buyerId: offer.buyerId,
            sellerId: offer.sellerId,
            offeredById: userId,
            parentOfferId: offer.id,
            amountMinor: answer.amountMinor as number,
            currency: offer.currency,
            listingPriceMinor: listing.priceMinor as number,
            expiresAt: new Date(now.getTime() + settings.offerExpiryHours * HOUR_MS),
            // A moment later than the divider, so the bubble comes after it in the thread.
            createdAt: new Date(now.getTime() + 1),
          })
          .returning();
        if (!created) throw new Error("Counter offer was not saved");
        counterOffer = created;
        messagesWritten.push(
          await insertOfferMessage(tx, {
            conversationId: offer.conversationId,
            senderId: userId,
            offerId: created.id,
            at: created.createdAt,
          }),
        );
      }
      return updated;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw ApiError.conflict("There is already an offer waiting for an answer");
    throw err;
  }

  const created = counterOffer as OfferRecord | null;
  await afterCommit(app, async () => {
    await broadcastOfferUpdated(app, conversation, offer.id);
    await broadcastNewMessages(app, conversation, messagesWritten);
    if (listingChanged) await broadcastListingUpdated(app, [offer.listingId]);
    const answerType = {
      accept: "offer_accepted",
      decline: "offer_declined",
      counter: "offer_countered",
    } as const;
    if (answer.event !== "withdraw") {
      await notifyEvent(app, {
        userId: offer.offeredById,
        type: answerType[answer.event],
        actorId: userId,
        listingId: offer.listingId,
        conversationId: offer.conversationId,
        data: offerData(created ?? offer, listing.title),
      });
    }
  });
  return { offer: presentOffer(offer), counter: created ? presentOffer(created) : null };
}

// ---- Expiry ----

/**
 * A pending offer ran out of time, or an accepted one was not checked out in time. The held item goes back on sale
 * unless an order is still waiting for payment.
 */
export async function expireOffer(app: App, offerId: string, now = new Date()): Promise<boolean> {
  let released = false;
  let conversation: ConversationRecord | undefined;
  let message: MessageRecord | undefined;
  let offer: OfferRecord | undefined;
  let title = "";
  const done = await app.db.transaction(async (tx) => {
    const [row] = await tx.select().from(offers).where(eq(offers.id, offerId)).for("update").limit(1);
    if (!row || !canOfferTransition(row.status, "expire") || row.expiresAt > now) return false;
    if (row.status === "accepted") {
      // The buyer has an order in progress or finished from this offer: the offer did its job.
      const [live] = await tx
        .select({ n: count() })
        .from(orders)
        .where(and(eq(orders.offerId, row.id), ne(orders.status, "cancelled")));
      if ((live?.n ?? 0) > 0) return false;
    }
    const [updated] = await tx
      .update(offers)
      .set({ status: "expired", respondedAt: row.respondedAt ?? now })
      .where(eq(offers.id, row.id))
      .returning();
    offer = updated;
    const [chat] = await tx.select().from(conversations).where(eq(conversations.id, row.conversationId)).limit(1);
    conversation = chat;
    const [item] = await tx.select().from(listings).where(eq(listings.id, row.listingId)).for("update").limit(1);
    title = item?.title ?? "";
    if (row.status === "accepted" && item?.status === "reserved" && item.reservedForUserId === row.buyerId) {
      await tx
        .update(listings)
        .set({ status: "active", reservedForUserId: null, reservedUntil: null })
        .where(eq(listings.id, row.listingId));
      released = true;
    }
    if (chat) {
      message = await insertSystemMessage(tx, {
        conversationId: chat.id,
        event: "offer_expired",
        payload: { offerId: row.id, amountMinor: row.amountMinor, currency: row.currency, title },
        at: now,
      });
    }
    return true;
  });
  if (!done || !offer || !conversation) return done;
  const chat = conversation;
  const expired = offer;
  await afterCommit(app, async () => {
    await broadcastOfferUpdated(app, chat, expired.id);
    if (message) await broadcastNewMessages(app, chat, [message]);
    if (released) await broadcastListingUpdated(app, [expired.listingId]);
    for (const userId of [expired.buyerId, expired.sellerId]) {
      await notifyEvent(app, {
        userId,
        type: "offer_expired",
        listingId: expired.listingId,
        conversationId: chat.id,
        data: offerData(expired, title),
      });
    }
  });
  return true;
}
