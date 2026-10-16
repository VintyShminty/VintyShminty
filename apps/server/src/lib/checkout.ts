import {
  addresses,
  bundleItems,
  bundles,
  conversations,
  type Database,
  feeRules,
  listingPhotos,
  listings,
  offers,
  orderEvents,
  orderItems,
  orders,
  parcelSizes,
  profiles,
  sizes,
} from "@vinty/db";
import {
  bundleDiscountPercentFor,
  type CheckoutQuote,
  type CreateOrderInput,
  calculateOrderTotals,
  type DeliveryMethod,
  type QuoteInput,
} from "@vinty/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { awayNowSql } from "./away.js";
import { bundlePostage, loadBundleLadder } from "./bundles.js";
import { ApiError } from "./errors.js";
import { isBlockedBetween } from "./messaging.js";
import { isUniqueViolation } from "./offers.js";
import { loadOrderSettings, MINUTE_MS } from "./settings.js";
import { broadcastListingUpdated, type OrderRecord } from "./thread.js";

type Db = NonNullable<Database["db"]>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;
type App = FastifyInstance;

const unavailable = (message = "This item is not available") =>
  new ApiError(409, "listing_unavailable", message);

type Line = {
  listingId: string;
  title: string;
  brand: string | null;
  size: string | null;
  coverKey: string | null;
  priceMinor: number;
  listPriceMinor: number;
  parcelSizeId: string | null;
};

export type Resolved = {
  sellerId: string;
  currency: string;
  offerId: string | null;
  bundleId: string | null;
  conversationId: string | null;
  lines: Line[];
  bundleDiscountPercent: number;
};

/** The buyer protection rule for a currency, with its id so the order can point at what it used. */
async function activeFeeRule(db: Exec, currency: string) {
  const [rule] = await db
    .select()
    .from(feeRules)
    .where(and(eq(feeRules.currency, currency), eq(feeRules.isActive, true)))
    .orderBy(desc(feeRules.activeFrom))
    .limit(1);
  return rule ?? null;
}

/**
 * What the buyer is buying, checked: the item (or items) must be on sale or held for this buyer, belong to one
 * seller and not to the buyer, and nobody may have blocked anybody. With `lock` the listing rows stay locked
 * until the transaction ends, so two buyers cannot reserve the same item.
 */
export async function resolveTarget(
  db: Exec,
  buyerId: string,
  target: { listingId?: string | undefined; bundleId?: string | undefined; offerId?: string | undefined },
  lock: boolean,
  now: Date,
): Promise<Resolved> {
  let listingIds: string[];
  let offerId: string | null = null;
  let bundleId: string | null = null;
  let conversationId: string | null = null;
  let agreedPrice: number | null = null;
  let bundleSellerId: string | null = null;

  if (target.offerId) {
    const [offer] = await db
      .select()
      .from(offers)
      .where(and(eq(offers.id, target.offerId), eq(offers.buyerId, buyerId)))
      .limit(1);
    if (!offer) throw ApiError.notFound();
    if (offer.status !== "accepted" || offer.expiresAt <= now) {
      throw new ApiError(409, "invalid_transition", "This offer is no longer open");
    }
    offerId = offer.id;
    conversationId = offer.conversationId;
    agreedPrice = offer.amountMinor;
    listingIds = [offer.listingId];
  } else if (target.bundleId) {
    const [bundle] = await db
      .select()
      .from(bundles)
      .where(and(eq(bundles.id, target.bundleId), eq(bundles.buyerId, buyerId)))
      .limit(1);
    if (!bundle) throw ApiError.notFound();
    if (bundle.status !== "open") throw new ApiError(409, "invalid_transition", "This bundle is closed");
    const items = await db
      .select({ listingId: bundleItems.listingId })
      .from(bundleItems)
      .where(eq(bundleItems.bundleId, bundle.id))
      .orderBy(asc(bundleItems.addedAt));
    if (items.length === 0) throw ApiError.conflict("The bundle is empty");
    bundleId = bundle.id;
    bundleSellerId = bundle.sellerId;
    listingIds = items.map((i) => i.listingId);
  } else if (target.listingId) {
    listingIds = [target.listingId];
  } else {
    throw ApiError.invalid("Choose what to buy");
  }

  const query = db
    .select({
      l: listings,
      sizeLabel: sizes.label,
      coverKey: sql<
        string | null
      >`(select ${listingPhotos.objectKey} from ${listingPhotos} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.position} asc limit 1)`,
      sellerGone: sql<boolean>`exists (select 1 from ${profiles} where ${profiles.userId} = ${listings.sellerId} and (${profiles.deletedAt} is not null or ${awayNowSql}))`,
    })
    .from(listings)
    .leftJoin(sizes, eq(sizes.id, listings.sizeId))
    .where(inArray(listings.id, listingIds))
    .orderBy(asc(listings.id));
  const rows = await (lock ? query.for("update", { of: listings }) : query);
  if (rows.length !== new Set(listingIds).size) throw ApiError.notFound();

  const sellerIds = new Set(rows.map((r) => r.l.sellerId));
  const [sellerId] = [...sellerIds];
  if (sellerIds.size !== 1 || !sellerId || (bundleSellerId && bundleSellerId !== sellerId)) {
    throw ApiError.conflict("A bundle is made of one seller's items");
  }
  if (sellerId === buyerId) throw ApiError.forbidden("You cannot buy your own item");
  if (await isBlockedBetween({ db: db as Db }, buyerId, sellerId)) {
    throw new ApiError(403, "blocked", "You cannot buy from this person");
  }

  for (const { l, sellerGone } of rows) {
    if (l.status === "draft" || l.status === "hidden" || l.status === "removed") throw ApiError.notFound();
    const heldForBuyer = l.status === "reserved" && l.reservedForUserId === buyerId;
    if (sellerGone || l.priceMinor === null || (l.status !== "active" && !heldForBuyer)) throw unavailable();
  }

  const currency = (rows[0] as (typeof rows)[number]).l.currency;
  if (rows.some((r) => r.l.currency !== currency))
    throw ApiError.conflict("Items in one order share a currency");

  const lines: Line[] = rows.map(({ l, sizeLabel, coverKey }) => ({
    listingId: l.id,
    title: l.title,
    brand: l.brandName,
    size: sizeLabel,
    coverKey,
    listPriceMinor: l.priceMinor as number,
    priceMinor: agreedPrice ?? (l.priceMinor as number),
    parcelSizeId: l.parcelSizeId,
  }));

  let bundleDiscountPercent = 0;
  if (bundleId) {
    const { tiers } = await loadBundleLadder(db, sellerId);
    bundleDiscountPercent = bundleDiscountPercentFor(tiers, lines.length);
  }

  if (!conversationId && !lock) {
    const [chat] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(eq(conversations.listingId, lines[0]?.listingId as string), eq(conversations.buyerId, buyerId)),
      )
      .limit(1);
    conversationId = chat?.id ?? null;
  }

  return { sellerId, currency, offerId, bundleId, conversationId, lines, bundleDiscountPercent };
}

/** Postage: the biggest parcel in the order sets the price. Both delivery methods cost the same in version 1. */
async function postageFor(db: Exec, lines: Line[]) {
  const ids = [...new Set(lines.flatMap((l) => (l.parcelSizeId ? [l.parcelSizeId] : [])))];
  if (ids.length === 0) return { shippingMinor: 0, parcelSizeId: null as string | null };
  const parcels = await db.select().from(parcelSizes).where(inArray(parcelSizes.id, ids));
  const biggest = parcels.sort((a, b) => b.priceMinor - a.priceMinor)[0];
  return { shippingMinor: biggest?.priceMinor ?? 0, parcelSizeId: biggest?.id ?? null };
}

async function totalsFor(db: Exec, resolved: Resolved) {
  const rule = await activeFeeRule(db, resolved.currency);
  const postage = await postageFor(db, resolved.lines);
  const totals = calculateOrderTotals({
    itemPricesMinor: resolved.lines.map((l) => l.priceMinor),
    bundleDiscountPercent: resolved.bundleDiscountPercent,
    shippingMinor: postage.shippingMinor,
    feeRule: rule ?? { buyerFeeBasisPoints: 0, buyerFeeFixedMinor: 0 },
  });
  return { totals, rule, postage };
}

/** The numbers for the Price breakdown sheet and the Checkout total. Reserves nothing. */
export async function quoteCheckout(app: App, buyerId: string, input: QuoteInput): Promise<CheckoutQuote> {
  const now = new Date();
  const resolved = await resolveTarget(app.db, buyerId, input, false, now);
  const { totals, postage } = await totalsFor(app.db, resolved);
  const settings = await loadOrderSettings(app.db);
  const method = input.deliveryMethod ?? "pickup_point";
  const parcels = resolved.bundleId
    ? await bundlePostage(
        app.db,
        resolved.lines.map((l) => l.parcelSizeId),
      )
    : { separateMinor: 0, togetherMinor: 0 };
  return {
    sellerId: resolved.sellerId,
    offerId: resolved.offerId,
    bundleId: resolved.bundleId,
    postageSavedMinor: Math.max(0, parcels.separateMinor - parcels.togetherMinor),
    items: resolved.lines.map((l) => ({
      listingId: l.listingId,
      title: l.title,
      brand: l.brand,
      size: l.size,
      photoUrl: l.coverKey ? app.storage.publicUrl(l.coverKey) : null,
      priceMinor: l.priceMinor,
    })),
    itemsSubtotalMinor: totals.itemsSubtotalMinor,
    bundleDiscountPercent: resolved.bundleDiscountPercent,
    bundleDiscountMinor: totals.bundleDiscountMinor,
    buyerProtectionFeeMinor: totals.buyerProtectionFeeMinor,
    shippingMinor: totals.shippingMinor,
    voucherDiscountMinor: totals.voucherDiscountMinor,
    totalMinor: totals.totalMinor,
    currency: resolved.currency,
    deliveryMethod: method,
    deliveryOptions: (["pickup_point", "home"] as const).map((m) => ({
      method: m,
      priceMinor: postage.shippingMinor,
      available: true,
    })),
    holdMinutes: settings.checkoutHoldMinutes,
  };
}

export type CreatedOrder = { order: OrderRecord; created: boolean };

async function findByKey(db: Exec, buyerId: string, key: string | undefined) {
  if (!key) return undefined;
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.buyerId, buyerId), eq(orders.idempotencyKey, key)))
    .limit(1);
  return row;
}

/**
 * Starts checkout: locks the item, holds it for the buyer for 30 minutes and writes the order with a snapshot of
 * every number. The same buyer opening checkout again for the same items gets the same order back.
 */
export async function createOrder(
  app: App,
  buyerId: string,
  input: CreateOrderInput,
  idempotencyKey?: string,
): Promise<CreatedOrder> {
  const again = await findByKey(app.db, buyerId, idempotencyKey);
  if (again) return { order: again, created: false };

  const method: DeliveryMethod = input.deliveryMethod;
  let address: typeof addresses.$inferSelect | undefined;
  if (input.addressId) {
    [address] = await app.db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, buyerId)))
      .limit(1);
    if (!address)
      throw ApiError.invalid("Choose one of your addresses", { addressId: "validation.checkout.address" });
  }
  if (method === "home" && !address) {
    throw ApiError.invalid("Add an address for home delivery", {
      addressId: "validation.checkout.addressRequired",
    });
  }
  const settings = await loadOrderSettings(app.db);
  const now = new Date();
  const payBy = new Date(now.getTime() + settings.checkoutHoldMinutes * MINUTE_MS);

  let result: CreatedOrder & { listingIds: string[] };
  try {
    result = await app.db.transaction(async (tx) => {
      const resolved = await resolveTarget(tx, buyerId, input, true, now);
      const { totals, rule, postage } = await totalsFor(tx, resolved);
      const listingIds = resolved.lines.map((l) => l.listingId);

      // Open checkouts of this buyer that touch the same items: the same ones are reused, others are dropped.
      const open = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.buyerId, buyerId), eq(orders.status, "pending_payment")))
        .for("update");
      let reuse: OrderRecord | undefined;
      for (const old of open) {
        const items = await tx
          .select({ listingId: orderItems.listingId })
          .from(orderItems)
          .where(eq(orderItems.orderId, old.id));
        const oldIds = items.flatMap((i) => (i.listingId ? [i.listingId] : []));
        if (!oldIds.some((id) => listingIds.includes(id))) continue;
        const same =
          oldIds.length === listingIds.length &&
          oldIds.every((id) => listingIds.includes(id)) &&
          old.offerId === resolved.offerId &&
          old.bundleId === resolved.bundleId;
        if (same) {
          reuse = old;
        } else {
          await tx
            .update(orders)
            .set({
              status: "cancelled",
              cancelReason: "buyer_cancelled",
              cancelledById: buyerId,
              cancelledAt: now,
              payByAt: null,
            })
            .where(eq(orders.id, old.id));
          await tx.insert(orderEvents).values({
            orderId: old.id,
            event: "cancel",
            fromStatus: "pending_payment",
            toStatus: "cancelled",
            actorId: buyerId,
            actorRole: "buyer",
            note: "Replaced by a new checkout",
          });
        }
      }

      // The thread the order's dividers go into: the chat about this item, made now when there is none.
      let conversationId = resolved.conversationId;
      if (!conversationId) {
        const firstListingId = resolved.lines[0]?.listingId as string;
        await tx
          .insert(conversations)
          .values({ listingId: firstListingId, buyerId, sellerId: resolved.sellerId })
          .onConflictDoNothing();
        const [chat] = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(eq(conversations.listingId, firstListingId), eq(conversations.buyerId, buyerId)))
          .limit(1);
        conversationId = chat?.id ?? null;
      }

      const snapshot = {
        currency: resolved.currency,
        itemsSubtotalMinor: totals.itemsSubtotalMinor,
        bundleDiscountMinor: totals.bundleDiscountMinor,
        buyerProtectionFeeMinor: totals.buyerProtectionFeeMinor,
        shippingMinor: totals.shippingMinor,
        voucherDiscountMinor: totals.voucherDiscountMinor,
        totalMinor: totals.totalMinor,
        sellerEarningsMinor: totals.sellerEarningsMinor,
        feeRuleId: rule?.id ?? null,
        feeBasisPoints: rule?.buyerFeeBasisPoints ?? 0,
        feeFixedMinor: rule?.buyerFeeFixedMinor ?? 0,
        deliveryMethod: method,
        parcelSizeId: postage.parcelSizeId,
        shippingAddressId: address?.id ?? null,
        shippingAddress: address
          ? {
              label: address.label,
              fullName: address.fullName,
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              postcode: address.postcode,
              countryCode: address.countryCode,
              phone: address.phone,
              isDefault: address.isDefault,
            }
          : null,
        payByAt: payBy,
      };

      let order: OrderRecord;
      let created = true;
      if (reuse) {
        [order] = (await tx
          .update(orders)
          .set({ ...snapshot, conversationId })
          .where(eq(orders.id, reuse.id))
          .returning()) as [OrderRecord];
        created = false;
      } else {
        [order] = (await tx
          .insert(orders)
          .values({
            buyerId,
            sellerId: resolved.sellerId,
            conversationId,
            offerId: resolved.offerId,
            bundleId: resolved.bundleId,
            status: "pending_payment",
            idempotencyKey: idempotencyKey ?? null,
            ...snapshot,
          })
          .returning()) as [OrderRecord];
        await tx.insert(orderItems).values(
          resolved.lines.map((l) => ({
            orderId: order.id,
            listingId: l.listingId,
            priceMinor: l.priceMinor,
            titleSnapshot: l.title,
            brandSnapshot: l.brand,
            sizeSnapshot: l.size,
            photoKeySnapshot: l.coverKey,
          })),
        );
        await tx.insert(orderEvents).values({
          orderId: order.id,
          event: "create",
          fromStatus: null,
          toStatus: "pending_payment",
          actorId: buyerId,
          actorRole: "buyer",
        });
      }

      // The item is held for the buyer while they pay.
      await tx
        .update(listings)
        .set({ status: "reserved", reservedForUserId: buyerId, reservedUntil: payBy })
        .where(inArray(listings.id, listingIds));
      return { order, created, listingIds };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await findByKey(app.db, buyerId, idempotencyKey);
      if (raced) return { order: raced, created: false };
    }
    throw err;
  }

  try {
    await broadcastListingUpdated(app, result.listingIds, [buyerId]);
    app.realtime.toUser(buyerId).emit("order:updated", {
      orderId: result.order.id,
      status: result.order.status,
      conversationId: result.order.conversationId,
    });
  } catch (err) {
    app.log.error({ err }, "could not announce a new checkout");
  }
  return { order: result.order, created: result.created };
}
