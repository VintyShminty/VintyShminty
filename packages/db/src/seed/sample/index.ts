import { calculateOrderTotals, type OrderEvent, type OrderStatus } from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  addresses,
  blocks,
  bumps,
  bundleDiscountTiers,
  bundleItems,
  bundles,
  conversations,
  favourites,
  follows,
  listingColours,
  listingPhotos,
  listingPriceHistory,
  listings,
  messages,
  notificationPreferences,
  notifications,
  offers,
  orderEvents,
  orderItems,
  orders,
  payments,
  profiles,
  pushTokens,
  recentSearches,
  referrals,
  reports,
  reviews,
  savedSearches,
  shipments,
  userBadges,
  userBrands,
  userSettings,
  userSizes,
  users,
  vouchers,
  walletEntries,
} from "../../schema/index.js";
import type { SeedDb } from "../connection.js";
import { type Archetype, archetypes, photoGroups } from "./archetypes.js";
import { seedBehaviour } from "./behaviour.js";
import { loadRefContext } from "./context.js";
import { samplePeople, streets } from "./people.js";
import { assertAssetsExist, photoSizes } from "./photos.js";
import { Rng } from "./rng.js";
import * as text from "./text.js";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Person {
  id: string;
  username: string;
  name: string;
  city: string;
  locale: "en" | "he";
  createdAt: Date;
}

interface Item {
  row: Insert<typeof listings> & { id: string; sellerId: string; title: string };
  lang: "he" | "en";
  photoKeys: string[];
  colourIds: string[];
  categorySlug: string;
  favouritedBy: Set<string>;
}

async function insertChunks<T>(insert: (rows: T[]) => PromiseLike<unknown>, rows: T[], size = 300) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

/**
 * Fills a freshly migrated development database with believable data so every screen has something to show.
 * It wipes all user generated data first, so running it twice gives the same result.
 */
export async function seedSample(db: SeedDb): Promise<Record<string, number>> {
  assertAssetsExist();
  const ref = await loadRefContext(db);
  const rng = new Rng(20261012);
  const now = new Date();
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * HOUR);
  const plus = (date: Date, minutes: number) =>
    new Date(Math.min(now.getTime(), date.getTime() + minutes * 60_000));

  await db.execute(sql`truncate table users restart identity cascade`);

  // ---------------------------------------------------------------- people
  const people: Person[] = samplePeople.map((p) => ({
    id: rng.uuid(),
    username: p.username,
    name: p.name,
    city: p.city,
    locale: p.locale,
    createdAt: ago(p.daysAgo),
  }));
  const byUsername = new Map(people.map((p) => [p.username, p]));
  const person = (username: string) => byUsername.get(username) as Person;

  await db.insert(users).values(
    people.map((p) => ({
      id: p.id,
      name: p.name,
      email: `${p.username}@example.test`,
      emailVerified: true,
      username: p.username,
      displayUsername: p.username,
      role:
        p.username === "noa_levi"
          ? ("admin" as const)
          : p.username === "yael.goldberg"
            ? ("moderator" as const)
            : ("user" as const),
      createdAt: p.createdAt,
      updatedAt: p.createdAt,
    })),
  );
  await db.insert(userSettings).values(
    people.map((p) => ({
      userId: p.id,
      language: p.locale,
      pushDailyLimit: rng.chance(0.2) ? 10 : null,
      shipFromHome: rng.chance(0.15),
    })),
  );
  await db.insert(addresses).values(
    people.map((p) => ({
      userId: p.id,
      fullName: p.name,
      line1: `${rng.pick(streets)} ${rng.int(1, 120)}`,
      line2: rng.chance(0.3) ? `דירה ${rng.int(1, 30)}` : null,
      city: p.city,
      postcode: String(rng.int(1000000, 9999999)),
      phone: `05${rng.int(0, 9)}${rng.int(1000000, 9999999)}`,
      isDefault: true,
    })),
  );

  // -------------------------------------------------------------- listings
  const items: Item[] = [];
  const brandOf = (name: string) => {
    const id = ref.brandByName.get(name);
    if (!id) throw new Error(`Sample brand "${name}" is not in the reference brand list`);
    return id;
  };
  const conditionWeights = [
    ["new-with-tags", 0.1],
    ["new-without-tags", 0.1],
    ["very-good", 0.4],
    ["good", 0.3],
    ["satisfactory", 0.1],
  ] as const;
  const pickCondition = () => {
    let r = rng.next();
    for (const [slug, w] of conditionWeights) {
      if (r < w) return ref.conditionSlugs.find((c) => c.slug === slug)?.id as string;
      r -= w;
    }
    return ref.conditionSlugs[2]?.id as string;
  };

  const makeItem = (arch: Archetype, draft = false): Item => {
    const cat = ref.categories.get(arch.cat);
    if (!cat) throw new Error(`Sample category "${arch.cat}" does not exist`);
    const seller = rng.pick(people);
    const lang: "he" | "en" = rng.chance(0.65) ? "he" : "en";
    const brandName = arch.brands.length > 0 ? rng.pick(arch.brands) : null;
    const titleTemplate = rng.pick(lang === "he" ? arch.titlesHe : arch.titlesEn);
    const title = titleTemplate
      .replace("{brand}", brandName ?? "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const priceIls = rng.int(arch.price[0], arch.price[1]);
    const priceMinor = roundTo(priceIls, priceIls > 500 ? 10 : 5) * 100;
    const publishedAt = ago(Math.floor(rng.next() ** 1.6 * 80), rng.int(0, 23));
    const sizeList = ref.categorySizes.get(arch.cat) ?? [];
    const sizeId =
      cat.sizeMode !== "hidden" && sizeList.length > 0
        ? (sizeList[Math.min(sizeList.length - 1, Math.floor(sizeList.length * (0.2 + rng.next() * 0.5)))] ??
          null)
        : null;
    const colourIds = cat.colourMode !== "hidden" ? rng.sample(ref.colourIds, rng.chance(0.7) ? 1 : 2) : [];
    const materialSlug = arch.materials ? rng.pick(arch.materials) : null;
    const photoFiles = rng.sample(photoGroups[arch.photo], rng.int(1, 4));
    const extra = brandName ? (lang === "he" ? `מותג: ${brandName}.` : `Brand: ${brandName}.`) : "";
    const id = rng.uuid();
    const seq = String(items.length + 1).padStart(3, "0");
    return {
      lang,
      categorySlug: arch.cat,
      colourIds,
      favouritedBy: new Set(),
      photoKeys: photoFiles.map((f) => `seed/listings/${seq}/${f}.jpg`),
      row: {
        id,
        sellerId: seller.id,
        status: draft ? "draft" : "active",
        title,
        description: draft ? "" : text.describe(rng, lang, extra),
        categoryId: cat.id,
        brandId: brandName ? brandOf(brandName) : null,
        brandName,
        sizeId,
        conditionId: pickCondition(),
        materialId: materialSlug ? (ref.materialBySlug.get(materialSlug) ?? null) : null,
        patternId: cat.patternMode !== "hidden" && rng.chance(0.4) ? rng.pick(ref.patternIds) : null,
        parcelSizeId: cat.defaultParcelSizeId,
        priceMinor,
        currency: "ILS",
        countryCode: "IL",
        city: seller.city,
        usedAiPhotos: false,
        viewCount: rng.int(3, 400),
        bumpedAt: publishedAt,
        publishedAt: draft ? null : publishedAt,
        createdAt: plus(publishedAt, -60),
        updatedAt: publishedAt,
      },
    };
  };

  for (const arch of archetypes) for (let i = 0; i < arch.count; i++) items.push(makeItem(arch));
  // Six drafts, two of them without a price yet.
  for (let i = 0; i < 6; i++) {
    const draft = makeItem(rng.pick(archetypes), true);
    if (i < 2) draft.row.priceMinor = null;
    draft.row.bumpedAt = ago(rng.int(0, 5));
    items.push(draft);
  }
  const live = () => items.filter((i) => i.row.status === "active");

  // Hidden and removed
  for (const item of rng.sample(live(), 4)) item.row.status = "hidden";
  for (const item of rng.sample(live(), 2)) {
    item.row.status = "removed";
    item.row.statusReason = "Removed by a moderator after a report";
  }

  // Nine live dresses become Zara, so the person with a clear taste (below) has enough of them to lean towards.
  // No random numbers are used here, so the rest of the sample data stays the same.
  const zaraId = brandOf("Zara");
  const zaraDresses = items.filter(
    (i) =>
      i.categorySlug.startsWith("women-clothing-dresses") &&
      i.row.status === "active" &&
      i.row.sellerId !== person("noa_levi").id,
  );
  for (const item of zaraDresses.slice(0, 9)) {
    const was = item.row.brandName;
    if (was && was !== "Zara") {
      item.row.title = item.row.title.replace(was, "Zara");
      item.row.description = item.row.description?.replace(was, "Zara");
    }
    item.row.brandId = zaraId;
    item.row.brandName = "Zara";
  }

  // Price drops: 14% of live listings were cheaper after a drop
  const priceHistory: Insert<typeof listingPriceHistory>[] = [];
  for (const item of rng.sample(live(), Math.round(live().length * 0.14))) {
    const now_ = item.row.priceMinor as number;
    const old = roundTo(Math.round((now_ * rng.pick([1.15, 1.25, 1.33])) / 100), 5) * 100;
    if (old <= now_) continue;
    item.row.previousPriceMinor = old;
    priceHistory.push({
      listingId: item.row.id,
      oldPriceMinor: old,
      newPriceMinor: now_,
      changedAt: ago(rng.int(0, 9), rng.int(0, 20)),
    });
  }

  // Bumps: 10 running, 6 finished
  const bumpRows: Insert<typeof bumps>[] = [];
  rng.sample(live(), 16).forEach((item, index) => {
    const running = index < 10;
    const startsAt = running ? ago(0, rng.int(1, 40)) : ago(rng.int(8, 20));
    const plan = rng.pick(ref.bumpPlanIds);
    const endsAt = new Date(startsAt.getTime() + (running ? 72 : 48) * HOUR);
    bumpRows.push({
      listingId: item.row.id,
      userId: item.row.sellerId,
      planId: plan,
      startsAt,
      endsAt,
      currency: "ILS",
    });
    item.row.bumpedAt = startsAt;
    item.row.bumpedUntil = endsAt;
  });

  // ------------------------------------------------------------ commerce
  const personById = new Map(people.map((p) => [p.id, p]));
  const convs = new Map<
    string,
    Insert<typeof conversations> & { id: string; listingId: string; buyerId: string; sellerId: string }
  >();
  const convKey = (listingId: string, buyerId: string) => `${listingId}:${buyerId}`;
  const msgRows: (Insert<typeof messages> & { id: string })[] = [];
  const offerRows: (Insert<typeof offers> & { id: string })[] = [];
  const orderRows: (Insert<typeof orders> & { id: string })[] = [];
  const orderItemRows: Insert<typeof orderItems>[] = [];
  const eventRows: Insert<typeof orderEvents>[] = [];
  const paymentRows: Insert<typeof payments>[] = [];
  const shipmentRows: Insert<typeof shipments>[] = [];
  const walletRows: Insert<typeof walletEntries>[] = [];
  const reviewRows: Insert<typeof reviews>[] = [];
  const notificationRows: Insert<typeof notifications>[] = [];
  const bundleRows: Insert<typeof bundles>[] = [];
  const bundleItemRows: Insert<typeof bundleItems>[] = [];
  const usedListings = new Set<string>();

  const getConversation = (item: Item, buyer: Person, startedAt: Date) => {
    const key = convKey(item.row.id, buyer.id);
    let conv = convs.get(key);
    if (!conv) {
      conv = {
        id: rng.uuid(),
        listingId: item.row.id,
        buyerId: buyer.id,
        sellerId: item.row.sellerId,
        lastMessageAt: startedAt,
        createdAt: startedAt,
      };
      convs.set(key, conv);
    }
    return conv;
  };
  const say = (convId: string, senderId: string | null, body: string, at: Date) => {
    msgRows.push({ id: rng.uuid(), conversationId: convId, senderId, kind: "text", body, createdAt: at });
  };
  const chat = (
    conv: { id: string; buyerId: string; sellerId: string },
    lang: "he" | "en",
    start: Date,
    turns: number,
  ) => {
    const pool = lang === "he" ? text.chatHe : text.chatEn;
    say(conv.id, conv.buyerId, rng.pick(pool.buyerOpen), start);
    if (turns > 1) say(conv.id, conv.sellerId, rng.pick(pool.sellerReply), plus(start, rng.int(5, 90)));
    if (turns > 2) say(conv.id, conv.buyerId, rng.pick(pool.buyerFollow), plus(start, rng.int(100, 240)));
    if (turns > 3) say(conv.id, conv.sellerId, rng.pick(pool.sellerClose), plus(start, rng.int(250, 400)));
  };
  const notify = (
    userId: string,
    type: Insert<typeof notifications>["type"],
    at: Date,
    refs: Partial<Pick<Insert<typeof notifications>, "actorId" | "listingId" | "orderId" | "conversationId">>,
    data: Record<string, unknown> = {},
  ) => {
    notificationRows.push({
      userId,
      type,
      createdAt: at,
      data,
      readAt: rng.chance(0.55) ? plus(at, rng.int(5, 600)) : null,
      ...refs,
    });
  };
  const makeOffer = (
    conv: { id: string; buyerId: string; sellerId: string },
    item: Item,
    amountMinor: number,
    offeredBy: string,
    status: Insert<typeof offers>["status"],
    at: Date,
    parentOfferId: string | null = null,
  ) => {
    const offerId = rng.uuid();
    offerRows.push({
      id: offerId,
      conversationId: conv.id,
      listingId: item.row.id,
      buyerId: conv.buyerId,
      sellerId: conv.sellerId,
      offeredById: offeredBy,
      parentOfferId,
      amountMinor,
      listingPriceMinor: item.row.priceMinor as number,
      status,
      expiresAt: new Date(at.getTime() + 48 * HOUR),
      respondedAt: status === "pending" ? null : plus(at, rng.int(10, 600)),
      createdAt: at,
      updatedAt: at,
    });
    msgRows.push({
      id: rng.uuid(),
      conversationId: conv.id,
      senderId: offeredBy,
      kind: "offer",
      offerId,
      createdAt: at,
    });
    return offerId;
  };
  const system = (
    convId: string,
    event: Insert<typeof messages>["systemEvent"],
    at: Date,
    orderId: string | null = null,
    payload: unknown = null,
  ) => {
    msgRows.push({
      id: rng.uuid(),
      conversationId: convId,
      senderId: null,
      kind: "system",
      systemEvent: event,
      orderId,
      payload,
      createdAt: at,
    });
  };

  // ---- orders
  interface OrderSpec {
    status: OrderStatus;
    items: Item[];
    buyer: Person;
    via?: "offer" | "bundle";
    cancelReason?: "buyer_cancelled" | "seller_cancelled" | "payment_failed" | "shipping_timeout";
    startDaysAgo: number;
    review?: "member" | "automatic" | "none";
  }
  let trackingNo = 4000;
  const placeOrder = (spec: OrderSpec) => {
    const [first] = spec.items as [Item, ...Item[]];
    const sellerId = first.row.sellerId;
    const seller = personById.get(sellerId) as Person;
    const buyer = spec.buyer;
    const lang = first.lang;
    const t0 = new Date(now.getTime() - spec.startDaysAgo * DAY);
    const conv = getConversation(first, buyer, plus(t0, -180));
    const orderId = rng.uuid();
    chat(conv, lang, plus(t0, -180), rng.int(2, 4));

    // price
    let prices = spec.items.map((i) => i.row.priceMinor as number);
    let offerId: string | null = null;
    if (spec.via === "offer") {
      const agreed = roundTo(((prices[0] as number) * 0.85) / 100, 5) * 100;
      offerId = makeOffer(conv, first, agreed, buyer.id, "accepted", plus(t0, -60));
      system(conv.id, "offer_accepted", plus(t0, -45), null, { amountMinor: agreed });
      prices = [agreed];
    }
    const parcels = spec.items.map(
      (i) =>
        ref.parcelBySlug.get(
          i.row.parcelSizeId
            ? ([...ref.parcelBySlug.values()].find((p) => p.id === i.row.parcelSizeId)?.slug ?? "small")
            : "small",
        )?.priceMinor ?? 1400,
    );
    const shippingMinor = Math.max(...parcels);
    const bundlePercent = spec.via === "bundle" ? (spec.items.length >= 3 ? 10 : 5) : 0;
    const totals = calculateOrderTotals({
      itemPricesMinor: prices,
      bundleDiscountPercent: bundlePercent,
      shippingMinor,
      feeRule: ref.feeRule,
    });

    // timeline
    const paidAt = plus(t0, 8);
    const shippedAt = plus(paidAt, 26 * 60 + rng.int(0, 600));
    const deliveredAt = plus(shippedAt, 48 * 60 + rng.int(0, 600));
    const completedAt = plus(deliveredAt, 20 * 60 + rng.int(0, 900));
    const events: {
      event: OrderEvent;
      from: OrderStatus | null;
      to: OrderStatus;
      at: Date;
      actor: "buyer" | "seller" | "system" | "admin";
      note?: string;
    }[] = [{ event: "create", from: null, to: "pending_payment", at: t0, actor: "buyer" }];
    const afterPaid =
      ["paid", "shipped", "delivered", "completed", "disputed", "refunded"].includes(spec.status) ||
      spec.cancelReason === "seller_cancelled" ||
      spec.cancelReason === "shipping_timeout";
    if (afterPaid)
      events.push({
        event: "pay",
        from: "pending_payment",
        to: "paid",
        at: paidAt,
        actor: "buyer",
        note: "Simulated payment",
      });
    if (["shipped", "delivered", "completed", "disputed", "refunded"].includes(spec.status))
      events.push({
        event: "ship",
        from: "paid",
        to: "shipped",
        at: shippedAt,
        actor: "seller",
        note: "Marked as shipped",
      });
    if (["delivered", "completed", "disputed", "refunded"].includes(spec.status))
      events.push({
        event: "deliver",
        from: "shipped",
        to: "delivered",
        at: deliveredAt,
        actor: "system",
        note: "Simulated delivery",
      });
    let finalAt = t0;
    if (spec.status === "completed") {
      const auto = rng.chance(0.25);
      events.push({
        event: auto ? "auto_complete" : "confirm_received",
        from: "delivered",
        to: "completed",
        at: completedAt,
        actor: auto ? "system" : "buyer",
      });
      finalAt = completedAt;
    } else if (spec.status === "disputed" || spec.status === "refunded") {
      const disputeAt = plus(deliveredAt, 300);
      events.push({
        event: "open_dispute",
        from: "delivered",
        to: "disputed",
        at: disputeAt,
        actor: "buyer",
        note: "Item not as described",
      });
      finalAt = disputeAt;
      if (spec.status === "refunded") {
        finalAt = plus(disputeAt, 1500);
        events.push({
          event: "refund",
          from: "disputed",
          to: "refunded",
          at: finalAt,
          actor: "admin",
          note: "Refunded by support",
        });
      }
    } else if (spec.status === "cancelled") {
      const from: OrderStatus = afterPaid ? "paid" : "pending_payment";
      finalAt = plus(afterPaid ? paidAt : t0, spec.cancelReason === "shipping_timeout" ? 5 * 24 * 60 : 50);
      events.push({
        event: "cancel",
        from,
        to: "cancelled",
        at: finalAt,
        actor:
          spec.cancelReason === "seller_cancelled"
            ? "seller"
            : spec.cancelReason === "buyer_cancelled"
              ? "buyer"
              : "system",
        note: spec.cancelReason,
      });
    } else if (spec.status === "shipped") finalAt = shippedAt;
    else if (spec.status === "delivered") finalAt = deliveredAt;
    else if (spec.status === "paid") finalAt = paidAt;

    const failedPayment = spec.cancelReason === "payment_failed";
    orderRows.push({
      id: orderId,
      buyerId: buyer.id,
      sellerId,
      conversationId: conv.id,
      offerId,
      status: spec.status,
      // A checkout that waits for payment holds the item for 12 hours in the sample data, so it can be tested by hand.
      payByAt: spec.status === "pending_payment" ? new Date(now.getTime() + 12 * HOUR) : null,
      cancelReason: spec.status === "cancelled" ? (spec.cancelReason ?? "other") : null,
      cancelledById:
        spec.status === "cancelled"
          ? spec.cancelReason === "seller_cancelled"
            ? sellerId
            : spec.cancelReason === "buyer_cancelled"
              ? buyer.id
              : null
          : null,
      currency: "ILS",
      itemsSubtotalMinor: totals.itemsSubtotalMinor,
      bundleDiscountMinor: totals.bundleDiscountMinor,
      buyerProtectionFeeMinor: totals.buyerProtectionFeeMinor,
      shippingMinor: totals.shippingMinor,
      voucherDiscountMinor: 0,
      totalMinor: totals.totalMinor,
      sellerEarningsMinor: totals.sellerEarningsMinor,
      feeRuleId: ref.feeRule.id,
      feeBasisPoints: ref.feeRule.buyerFeeBasisPoints,
      feeFixedMinor: ref.feeRule.buyerFeeFixedMinor,
      deliveryMethod: rng.chance(0.75) ? "pickup_point" : "home",
      parcelSizeId: first.row.parcelSizeId ?? null,
      shippingAddress: { fullName: buyer.name, city: buyer.city, country: "IL" },
      paidAt: afterPaid ? paidAt : null,
      shippedAt: ["shipped", "delivered", "completed", "disputed", "refunded"].includes(spec.status)
        ? shippedAt
        : null,
      deliveredAt: ["delivered", "completed", "disputed", "refunded"].includes(spec.status)
        ? deliveredAt
        : null,
      completedAt: spec.status === "completed" ? completedAt : null,
      cancelledAt: spec.status === "cancelled" ? finalAt : null,
      // Sample orders still waiting keep their deadlines in the future, so the background jobs leave them alone for a while.
      shipByAt: spec.status === "paid" ? new Date(paidAt.getTime() + 5 * DAY) : null,
      autoCompleteAt: spec.status === "delivered" ? new Date(now.getTime() + 3 * DAY) : null,
      createdAt: t0,
      updatedAt: finalAt,
    });
    spec.items.forEach((item, index) => {
      orderItemRows.push({
        orderId,
        listingId: item.row.id,
        priceMinor: prices[index] as number,
        titleSnapshot: item.row.title,
        brandSnapshot: item.row.brandName ?? null,
        photoKeySnapshot: item.photoKeys[0] ?? null,
        createdAt: t0,
      });
    });
    for (const e of events) {
      eventRows.push({
        orderId,
        event: e.event,
        fromStatus: e.from,
        toStatus: e.to,
        actorRole: e.actor,
        actorId: e.actor === "buyer" ? buyer.id : e.actor === "seller" ? sellerId : null,
        note: e.note ?? null,
        createdAt: e.at,
      });
    }

    // payment and shipment
    if (spec.status !== "pending_payment" || failedPayment) {
      paymentRows.push({
        orderId,
        provider: "simulated",
        status: failedPayment
          ? "failed"
          : spec.status === "refunded" || (spec.status === "cancelled" && afterPaid)
            ? "refunded"
            : "succeeded",
        amountMinor: totals.totalMinor,
        currency: "ILS",
        failureReason: failedPayment ? "Simulated failure" : null,
        paidAt: afterPaid ? paidAt : null,
        refundedAt: spec.status === "refunded" || (spec.status === "cancelled" && afterPaid) ? finalAt : null,
        createdAt: t0,
        updatedAt: finalAt,
      });
    } else {
      paymentRows.push({
        orderId,
        provider: "simulated",
        status: "pending",
        amountMinor: totals.totalMinor,
        currency: "ILS",
        createdAt: t0,
        updatedAt: t0,
      });
    }
    if (["shipped", "delivered", "completed", "disputed", "refunded"].includes(spec.status)) {
      trackingNo += 1;
      shipmentRows.push({
        orderId,
        provider: "simulated",
        status: spec.status === "shipped" ? "in_transit" : "delivered",
        carrier: "Simulated carrier",
        trackingCode: `SIM-${trackingNo}`,
        parcelSizeId: first.row.parcelSizeId ?? null,
        shippedAt,
        deliveredAt: spec.status === "shipped" ? null : deliveredAt,
        createdAt: shippedAt,
        updatedAt: finalAt,
      });
    }

    // thread dividers and notifications
    const itemTitle = first.row.title;
    const payload = { title: itemTitle, orderNumber: undefined as number | undefined };
    if (afterPaid) {
      system(conv.id, "order_paid", paidAt, orderId, payload);
      notify(
        sellerId,
        "order_paid",
        paidAt,
        { orderId, conversationId: conv.id, listingId: first.row.id, actorId: buyer.id },
        { title: itemTitle, amountMinor: totals.sellerEarningsMinor },
      );
    }
    if (events.some((e) => e.event === "ship")) {
      system(conv.id, "order_shipped", shippedAt, orderId, payload);
      notify(
        buyer.id,
        "order_shipped",
        shippedAt,
        { orderId, conversationId: conv.id, listingId: first.row.id },
        { title: itemTitle },
      );
    }
    if (events.some((e) => e.event === "deliver")) {
      system(conv.id, "order_delivered", deliveredAt, orderId, payload);
      notify(
        buyer.id,
        "order_delivered",
        deliveredAt,
        { orderId, conversationId: conv.id, listingId: first.row.id },
        { title: itemTitle },
      );
    }
    if (spec.status === "completed") {
      system(conv.id, "order_completed", completedAt, orderId, payload);
      notify(
        sellerId,
        "order_completed",
        completedAt,
        { orderId, conversationId: conv.id, listingId: first.row.id },
        { title: itemTitle },
      );
      notify(
        sellerId,
        "balance_released",
        plus(completedAt, 1),
        { orderId },
        { amountMinor: totals.sellerEarningsMinor },
      );
    }
    if (spec.status === "cancelled") {
      system(conv.id, "order_cancelled", finalAt, orderId, { reason: spec.cancelReason });
      notify(
        spec.cancelReason === "seller_cancelled" ? buyer.id : sellerId,
        "order_cancelled",
        finalAt,
        { orderId, conversationId: conv.id, listingId: first.row.id },
        { title: itemTitle, reason: spec.cancelReason },
      );
    }
    if (spec.status === "disputed" || spec.status === "refunded") {
      system(conv.id, "order_disputed", finalAt, orderId, payload);
    }
    if (spec.status === "refunded") system(conv.id, "order_refunded", finalAt, orderId, payload);

    // money ledger for the seller
    if (afterPaid && spec.status !== "cancelled") {
      walletRows.push({
        userId: sellerId,
        type: "sale_credit",
        status: spec.status === "completed" ? "available" : spec.status === "refunded" ? "void" : "pending",
        amountMinor: totals.sellerEarningsMinor,
        currency: "ILS",
        orderId,
        description: itemTitle,
        availableAt: spec.status === "completed" ? plus(completedAt, 1) : null,
        createdAt: paidAt,
      });
    }

    // reviews
    if (spec.status === "completed") {
      const review = spec.review ?? "member";
      const base = plus(completedAt, 30);
      if (review === "automatic") {
        reviewRows.push({
          orderId,
          reviewerId: buyer.id,
          revieweeId: sellerId,
          reviewerRole: "buyer",
          rating: 5,
          comment: null,
          isAutomatic: true,
          createdAt: base,
          updatedAt: base,
        });
        system(conv.id, "review_auto_left", base, orderId);
      } else if (review === "member") {
        const rating = rng.pick([5, 5, 5, 4, 4]);
        const replied = rng.chance(0.4);
        reviewRows.push({
          orderId,
          reviewerId: buyer.id,
          revieweeId: sellerId,
          reviewerRole: "buyer",
          rating,
          comment: rng.pick(lang === "he" ? text.reviewHe : text.reviewEn),
          isAutomatic: false,
          replyBody: replied ? rng.pick(lang === "he" ? text.replyHe : text.replyEn) : null,
          repliedAt: replied ? plus(base, 200) : null,
          createdAt: base,
          updatedAt: base,
        });
      }
      if (rng.chance(0.6)) {
        reviewRows.push({
          orderId,
          reviewerId: sellerId,
          revieweeId: buyer.id,
          reviewerRole: "seller",
          rating: rng.pick([5, 5, 4]),
          comment: rng.pick(lang === "he" ? text.reviewHe : text.reviewEn),
          isAutomatic: false,
          createdAt: plus(base, 90),
          updatedAt: plus(base, 90),
        });
        notify(buyer.id, "review_received", plus(base, 90), { orderId }, { rating: 5 });
      }
      if (review !== "none") notify(sellerId, "review_received", base, { orderId }, { rating: 5 });
    }

    // listing status
    for (const item of spec.items) {
      usedListings.add(item.row.id);
      if (["paid", "shipped", "delivered", "completed", "disputed"].includes(spec.status)) {
        item.row.status = "sold";
        item.row.soldAt = paidAt;
        item.row.reservedForUserId = null;
      } else if (spec.status === "pending_payment") {
        item.row.status = "reserved";
        item.row.reservedForUserId = buyer.id;
        item.row.reservedUntil = new Date(now.getTime() + 12 * HOUR);
      }
      // cancelled and refunded orders leave the listing active
    }

    // bundle
    if (spec.via === "bundle") {
      const bundleId = rng.uuid();
      bundleRows.push({
        id: bundleId,
        buyerId: buyer.id,
        sellerId,
        status: "ordered",
        createdAt: plus(t0, -20),
        updatedAt: t0,
      });
      for (const item of spec.items)
        bundleItemRows.push({ bundleId, listingId: item.row.id, addedAt: plus(t0, -20) });
      (orderRows[orderRows.length - 1] as { bundleId?: string }).bundleId = bundleId;
    }
    void seller;
  };

  // pick items for orders from live listings, spread over many sellers
  const freeItems = () => rng.shuffle(live().filter((i) => !usedListings.has(i.row.id) && i.row.priceMinor));
  const takeFor = (sellerNot?: string) => freeItems().find((i) => i.row.sellerId !== sellerNot) as Item;
  const buyerFor = (sellerId: string) => rng.pick(people.filter((p) => p.id !== sellerId));
  const bundleOf = (n: number) => {
    const bySeller = new Map<string, Item[]>();
    for (const i of freeItems()) bySeller.set(i.row.sellerId, [...(bySeller.get(i.row.sellerId) ?? []), i]);
    const group = [...bySeller.values()].find((g) => g.length >= n) as Item[];
    return group.slice(0, n);
  };
  const single = (status: OrderStatus, startDaysAgo: number, extra: Partial<OrderSpec> = {}) => {
    const item = takeFor();
    placeOrder({ status, items: [item], buyer: buyerFor(item.row.sellerId), startDaysAgo, ...extra });
  };

  single("pending_payment", 0.01);
  single("pending_payment", 0.015, { via: "offer" });
  {
    const items = bundleOf(3);
    placeOrder({
      status: "paid",
      items,
      buyer: buyerFor((items[0] as Item).row.sellerId),
      via: "bundle",
      startDaysAgo: 0.9,
    });
  }
  for (const d of [0.6, 1.2, 1.7]) single("paid", d);
  for (const d of [3, 4, 5.5]) single("shipped", d);
  single("shipped", 4.5, { via: "offer" });
  for (const d of [7, 9]) single("delivered", d);
  const completedPlan: [number, OrderSpec["review"], Partial<OrderSpec>?][] = [
    [14, "member"],
    [16, "member"],
    [18, "automatic"],
    [21, "member", { via: "offer" }],
    [24, "member"],
    [27, "automatic"],
    [31, "member"],
    [36, "member"],
    [41, "none"],
    [47, "member"],
    [55, "member"],
  ];
  for (const [days, review, extra] of completedPlan) single("completed", days, { review, ...extra });
  {
    const items = bundleOf(2);
    placeOrder({
      status: "completed",
      items,
      buyer: buyerFor((items[0] as Item).row.sellerId),
      via: "bundle",
      startDaysAgo: 33,
      review: "member",
    });
  }
  single("cancelled", 6, { cancelReason: "buyer_cancelled" });
  single("cancelled", 8, { cancelReason: "payment_failed" });
  single("cancelled", 12, { cancelReason: "seller_cancelled" });
  single("cancelled", 20, { cancelReason: "shipping_timeout" });
  single("disputed", 11);
  single("refunded", 26);

  // The three people the dev accounts sign in as get orders in every state, on both sides, so each screen has
  // something to show: they buy and they sell, with reviews, a balance and a few pretend withdrawals.
  {
    const oliver = person("oliver.smith");
    const tamar = person("tamar.avraham");
    const noa = person("noa_levi");
    const buying = (
      buyer: Person,
      status: OrderStatus,
      startDaysAgo: number,
      extra: Partial<OrderSpec> = {},
    ) => {
      const item = takeFor(buyer.id);
      placeOrder({ status, items: [item], buyer, startDaysAgo, ...extra });
    };
    const selling = (
      seller: Person,
      status: OrderStatus,
      startDaysAgo: number,
      extra: Partial<OrderSpec> = {},
    ) => {
      const item = freeItems().find((i) => i.row.sellerId === seller.id);
      if (!item) return;
      placeOrder({ status, items: [item], buyer: buyerFor(seller.id), startDaysAgo, ...extra });
    };
    buying(oliver, "pending_payment", 0.02, { via: "offer" });
    buying(oliver, "paid", 0.7);
    buying(oliver, "shipped", 3);
    buying(oliver, "delivered", 8);
    buying(oliver, "completed", 15, { review: "member" });
    buying(oliver, "cancelled", 7, { cancelReason: "buyer_cancelled" });
    buying(tamar, "paid", 1.1);
    buying(tamar, "shipped", 2.5, { via: "offer" });
    buying(tamar, "delivered", 6);
    buying(tamar, "completed", 20, { review: "member" });
    buying(tamar, "completed", 30, { review: "automatic" });
    buying(tamar, "cancelled", 10, { cancelReason: "seller_cancelled" });
    buying(noa, "shipped", 4);
    buying(noa, "delivered", 9);
    buying(noa, "completed", 13, { review: "member" });
    buying(noa, "completed", 40, { review: "none" });
    buying(noa, "cancelled", 18, { cancelReason: "payment_failed" });
    selling(oliver, "paid", 0.8);
    selling(oliver, "delivered", 5);
    selling(oliver, "completed", 17, { review: "member" });
    selling(tamar, "shipped", 3.5);
    selling(tamar, "completed", 22, { review: "member" });
    selling(tamar, "cancelled", 14, { cancelReason: "seller_cancelled" });
    selling(noa, "paid", 0.4);
    selling(noa, "shipped", 2);
    selling(noa, "completed", 11, { review: "member" });
    selling(noa, "completed", 35, { review: "automatic" });
  }

  // ---- conversations that never reached an order
  const openItems = freeItems();
  let cursor = 0;
  const nextOpen = () => openItems[cursor++] as Item;
  const lowOffer = (item: Item, pct: number) =>
    roundTo(((item.row.priceMinor as number) * pct) / 100 / 100, 5) * 100;
  const startConv = (item: Item, turns: number, startedHoursAgo: number, chosenBuyer?: Person) => {
    const buyer = chosenBuyer ?? buyerFor(item.row.sellerId);
    const conv = getConversation(item, buyer, ago(0, startedHoursAgo));
    chat(conv, item.lang, ago(0, startedHoursAgo), turns);
    return { conv, buyer };
  };
  /** The next free item, or the next free item that fits (for example one that a dev user sells). */
  const pickOpen = (fits?: (item: Item) => boolean) => {
    const at = fits ? openItems.findIndex((it, i) => i >= cursor && fits(it)) : -1;
    if (at >= 0) {
      const found = openItems[at] as Item;
      openItems[at] = openItems[cursor] as Item;
      openItems[cursor] = found;
    }
    return nextOpen();
  };
  for (let i = 0; i < 8; i++) startConv(nextOpen(), rng.int(1, 4), rng.int(2, 24 * 12));
  for (let i = 0; i < 2; i++) {
    const item = nextOpen();
    const { conv, buyer } = startConv(item, 2, rng.int(5, 100));
    msgRows.push({
      id: rng.uuid(),
      conversationId: conv.id,
      senderId: buyer.id,
      kind: "photo",
      attachmentKey: `seed/messages/${i + 1}/${item.photoKeys[0]?.split("/").pop() ?? "01-dress.jpg"}`,
      attachmentWidth: 600,
      attachmentHeight: 800,
      createdAt: ago(0, rng.int(1, 4)),
    });
  }
  type OpenOfferStatus = Insert<typeof offers>["status"];
  const openOffers: [OpenOfferStatus, number][] = [
    ["pending", 85],
    ["pending", 80],
    ["pending", 90],
    ["pending", 75],
    ["pending", 88],
    ["pending", 82],
    ["declined", 60],
    ["declined", 70],
    ["declined", 65],
    ["expired", 85],
    ["expired", 80],
    ["withdrawn", 90],
  ];
  const addOpenOffer = (status: OpenOfferStatus, pct: number, item: Item, chosenBuyer?: Person) => {
    const hoursAgo = status === "expired" ? 24 * 6 : status === "pending" ? rng.int(1, 30) : rng.int(10, 100);
    const { conv, buyer } = startConv(item, 1, hoursAgo + 2, chosenBuyer);
    const at = ago(0, hoursAgo);
    makeOffer(conv, item, lowOffer(item, pct), buyer.id, status, at);
    if (status === "pending")
      notify(
        item.row.sellerId,
        "new_offer",
        at,
        { listingId: item.row.id, conversationId: conv.id, actorId: buyer.id },
        { amountMinor: lowOffer(item, pct), title: item.row.title },
      );
    if (status === "declined") {
      system(conv.id, "offer_declined", plus(at, 120));
      notify(
        buyer.id,
        "offer_declined",
        plus(at, 120),
        { listingId: item.row.id, conversationId: conv.id },
        { title: item.row.title },
      );
    }
    if (status === "expired") system(conv.id, "offer_expired", plus(at, 48 * 60));
    if (status === "withdrawn") system(conv.id, "offer_withdrawn", plus(at, 30));
  };
  for (const [status, pct] of openOffers) addOpenOffer(status, pct, nextOpen());
  // countered: the buyer's offer was countered and the seller's counter waits for the buyer
  const addCounter = (item: Item, chosenBuyer?: Person) => {
    const { conv, buyer } = startConv(item, 1, 60, chosenBuyer);
    const first = makeOffer(conv, item, lowOffer(item, 70), buyer.id, "countered", ago(0, 50));
    system(conv.id, "offer_countered", ago(0, 48));
    makeOffer(conv, item, lowOffer(item, 90), item.row.sellerId, "pending", ago(0, 47), first);
    notify(
      buyer.id,
      "offer_countered",
      ago(0, 47),
      { listingId: item.row.id, conversationId: conv.id },
      { amountMinor: lowOffer(item, 90), title: item.row.title },
    );
  };
  for (let i = 0; i < 2; i++) addCounter(nextOpen());
  // accepted but not paid yet: the listing is reserved for the buyer
  const addAccepted = (item: Item, chosenBuyer?: Person) => {
    const { conv, buyer } = startConv(item, 1, 8, chosenBuyer);
    makeOffer(conv, item, lowOffer(item, 88), buyer.id, "accepted", ago(0, 6));
    system(conv.id, "offer_accepted", ago(0, 5));
    item.row.status = "reserved";
    item.row.reservedForUserId = buyer.id;
    item.row.reservedUntil = new Date(now.getTime() + 18 * HOUR);
    notify(
      buyer.id,
      "offer_accepted",
      ago(0, 5),
      { listingId: item.row.id, conversationId: conv.id },
      { title: item.row.title },
    );
  };
  for (let i = 0; i < 2; i++) addAccepted(nextOpen());

  // Offers for the dev accounts, in several states and on both sides.
  {
    const oliver = person("oliver.smith");
    const tamar = person("tamar.avraham");
    const noa = person("noa_levi");
    const notMine = (who: Person) => (it: Item) => it.row.sellerId !== who.id;
    const sells = (who: Person) => (it: Item) => it.row.sellerId === who.id;
    // They make offers
    addOpenOffer("pending", 80, pickOpen(notMine(oliver)), oliver);
    addOpenOffer("declined", 65, pickOpen(notMine(oliver)), oliver);
    addAccepted(pickOpen(notMine(oliver)), oliver);
    addCounter(pickOpen(notMine(tamar)), tamar);
    addOpenOffer("pending", 85, pickOpen(notMine(tamar)), tamar);
    addOpenOffer("expired", 80, pickOpen(notMine(tamar)), tamar);
    addOpenOffer("pending", 78, pickOpen(notMine(noa)), noa);
    addOpenOffer("withdrawn", 90, pickOpen(notMine(noa)), noa);
    addAccepted(pickOpen(notMine(noa)), noa);
    // They receive offers
    for (const who of [oliver, tamar, noa]) {
      addOpenOffer("pending", 82, pickOpen(sells(who)));
      addOpenOffer("pending", 70, pickOpen(sells(who)));
      addOpenOffer("declined", 60, pickOpen(sells(who)));
    }
  }
  // A few open bundles in progress
  for (let i = 0; i < 2; i++) {
    const free = freeItems();
    const bySeller = new Map<string, Item[]>();
    for (const it of free) bySeller.set(it.row.sellerId, [...(bySeller.get(it.row.sellerId) ?? []), it]);
    const group = [...bySeller.values()].filter((g) => g.length >= 2)[i] as Item[];
    const sellerId = (group[0] as Item).row.sellerId;
    const buyer = buyerFor(sellerId);
    const bundleId = rng.uuid();
    bundleRows.push({
      id: bundleId,
      buyerId: buyer.id,
      sellerId,
      status: "open",
      createdAt: ago(0, 5),
      updatedAt: ago(0, 4),
    });
    for (const it of group.slice(0, 2))
      bundleItemRows.push({ bundleId, listingId: it.row.id, addedAt: ago(0, 5) });
  }

  // ------------------------------------------------------------ social
  // Favourites: about 700, only on live or sold listings and never on your own
  const favouritable = items.filter((i) => ["active", "sold", "reserved"].includes(i.row.status as string));
  const favRows: Insert<typeof favourites>[] = [];
  // Noa hearts six Zara dresses on purpose (her taste, see seedBehaviour below)
  const noaPerson = person("noa_levi");
  const zaraNoaLikes = items.filter(
    (i) =>
      i.row.brandName === "Zara" &&
      i.categorySlug.startsWith("women-clothing-dresses") &&
      i.row.status === "active" &&
      i.row.sellerId !== noaPerson.id,
  );
  zaraNoaLikes.slice(0, 6).forEach((item, i) => {
    item.favouritedBy.add(noaPerson.id);
    favRows.push({
      userId: noaPerson.id,
      listingId: item.row.id,
      createdAt: ago(Math.min(5, i % 6), 1 + (i % 3)),
    });
  });
  for (let n = 0; n < 900 && favRows.length < 700; n++) {
    const item = rng.pick(favouritable);
    const user = rng.pick(people);
    if (user.id === item.row.sellerId || item.favouritedBy.has(user.id)) continue;
    item.favouritedBy.add(user.id);
    favRows.push({ userId: user.id, listingId: item.row.id, createdAt: ago(rng.int(0, 40), rng.int(0, 23)) });
  }
  for (const item of favouritable) {
    item.row.favouriteCount = item.favouritedBy.size;
    if (item.favouritedBy.size > 0 && rng.chance(0.5)) {
      const fan = [...item.favouritedBy][0] as string;
      notify(
        item.row.sellerId,
        "listing_favourited",
        ago(rng.int(0, 20), rng.int(0, 23)),
        { listingId: item.row.id, actorId: fan },
        { title: item.row.title },
      );
    }
    if (item.row.status === "sold" && item.favouritedBy.size > 0) {
      const fan = [...item.favouritedBy][0] as string;
      notify(
        fan,
        "favourite_sold",
        plus(item.row.soldAt as Date, 3),
        { listingId: item.row.id },
        { title: item.row.title },
      );
    }
    if (item.row.previousPriceMinor && item.favouritedBy.size > 0) {
      notify(
        [...item.favouritedBy][0] as string,
        "favourite_price_drop",
        ago(rng.int(0, 8)),
        { listingId: item.row.id },
        {
          title: item.row.title,
          oldPriceMinor: item.row.previousPriceMinor,
          newPriceMinor: item.row.priceMinor,
        },
      );
    }
  }

  const followRows: Insert<typeof follows>[] = [];
  const followSeen = new Set<string>();
  for (let n = 0; n < 160 && followRows.length < 70; n++) {
    const a = rng.pick(people);
    const b = rng.pick(people);
    const key = `${a.id}:${b.id}`;
    if (a.id === b.id || followSeen.has(key)) continue;
    followSeen.add(key);
    const at = ago(rng.int(0, 120));
    followRows.push({ followerId: a.id, followeeId: b.id, createdAt: at });
    if (rng.chance(0.4)) notify(b.id, "new_follower", at, { actorId: a.id }, { username: a.username });
  }
  const blockRows: Insert<typeof blocks>[] = [
    { blockerId: person("emma_j").id, blockedId: person("gal_haddad").id },
    { blockerId: person("shira_katz").id, blockedId: person("omer_peretz").id },
  ];

  // personalisation
  const sizeRows: Insert<typeof userSizes>[] = [];
  const brandRows: Insert<typeof userBrands>[] = [];
  for (const p of people) {
    for (const sizeId of new Set(rng.sample(ref.allSizeIds, 3))) sizeRows.push({ userId: p.id, sizeId });
    for (const name of new Set(rng.sample([...ref.brandByName.keys()].slice(0, 40), 3)))
      brandRows.push({ userId: p.id, brandId: ref.brandByName.get(name) as string });
  }

  // searches
  const searchRows: Insert<typeof savedSearches>[] = [
    {
      userId: person("noa_levi").id,
      queryText: "שמלה",
      filters: { sort: "newest", categoryPath: "women/clothing/dresses" },
    },
    { userId: person("noa_levi").id, queryText: "zara", filters: { priceMaxMinor: 20000 } },
    { userId: person("yoav.mizrahi").id, queryText: "nike", filters: { sort: "price_asc" } },
    { userId: person("yoav.mizrahi").id, queryText: "סניקרס", filters: {} },
    { userId: person("maya_bd").id, queryText: "לגו", filters: {} },
    { userId: person("itai_shapiro").id, queryText: "guitar", filters: {} },
    { userId: person("emma_j").id, queryText: "ג'ינס", filters: { sort: "newest" } },
    { userId: person("tamar.avraham").id, queryText: "vase", filters: {} },
  ].map((s, i) => ({ ...s, createdAt: ago(i * 3 + 1) }));
  const recentRows: Insert<typeof recentSearches>[] = [];
  for (const [i, q] of [
    "nike",
    "שמלה",
    "levi's",
    "תיק",
    "headphones",
    "ג'ינס",
    "zara",
    "מעיל",
    "sony",
    "adidas",
  ].entries()) {
    recentRows.push({
      userId: people[i % people.length]?.id as string,
      queryText: q,
      filters: {},
      resultCount: rng.int(3, 80),
      createdAt: ago(0, i * 5 + 1),
    });
  }

  // bundle discount ladders for sellers
  const tierRows: Insert<typeof bundleDiscountTiers>[] = [];
  for (const p of people.slice(0, 12)) {
    tierRows.push(
      { sellerId: p.id, minItems: 2, percentOff: 5 },
      { sellerId: p.id, minItems: 3, percentOff: 10 },
    );
    if (rng.chance(0.4)) tierRows.push({ sellerId: p.id, minItems: 5, percentOff: 15 });
  }

  // referrals and vouchers
  const gal = person("gal_haddad");
  const noa = person("noa_levi");
  const referralRows: Insert<typeof referrals>[] = [
    {
      inviterId: noa.id,
      inviteeId: gal.id,
      status: "rewarded",
      qualifiedAt: ago(5),
      rewardedAt: ago(5),
      createdAt: ago(13),
    },
    { inviterId: noa.id, inviteeId: person("sarah_m").id, status: "pending", createdAt: ago(40) },
  ];
  const voucherRows: Insert<typeof vouchers>[] = [
    {
      userId: noa.id,
      amountMinor: 5000,
      minOrderMinor: 5000,
      status: "active",
      expiresAt: ago(-60),
      createdAt: ago(5),
    },
    {
      userId: gal.id,
      amountMinor: 5000,
      minOrderMinor: 5000,
      status: "active",
      expiresAt: ago(-60),
      createdAt: ago(5),
    },
    {
      userId: person("lior_azulay").id,
      amountMinor: 5000,
      minOrderMinor: 5000,
      status: "expired",
      expiresAt: ago(10),
      createdAt: ago(80),
    },
  ];
  walletRows.push({
    userId: noa.id,
    type: "referral_bonus",
    status: "available",
    amountMinor: 5000,
    currency: "ILS",
    description: "Invite a friend",
    availableAt: ago(5),
    createdAt: ago(5),
  });

  // withdrawals (simulated) for sellers with completed sales
  const available = new Map<string, number>();
  for (const w of walletRows)
    if (w.status === "available") available.set(w.userId, (available.get(w.userId) ?? 0) + w.amountMinor);
  let withdrawals = 0;
  for (const [userId, amount] of available) {
    if (withdrawals >= 3 || amount < 6000) continue;
    walletRows.push({
      userId,
      type: "withdrawal",
      status: "available",
      amountMinor: -Math.floor(amount / 2 / 100) * 100,
      currency: "ILS",
      description: "Simulated withdrawal to bank account",
      createdAt: ago(2),
    });
    withdrawals++;
  }

  // push tokens and notification preferences
  const tokenRows: Insert<typeof pushTokens>[] = people.slice(0, 8).map((p, i) => ({
    userId: p.id,
    token: `ExponentPushToken[sample-${String(i + 1).padStart(2, "0")}]`,
    platform: i % 3 === 0 ? ("android" as const) : ("ios" as const),
    deviceId: `sample-device-${i + 1}`,
    locale: p.locale,
    lastSeenAt: ago(0, i * 3),
  }));
  const prefRows: Insert<typeof notificationPreferences>[] = [
    { userId: person("omer_peretz").id, type: "new_follower", channel: "push", enabled: false },
    { userId: person("omer_peretz").id, type: "followed_seller_new_item", channel: "push", enabled: false },
    { userId: person("shira_katz").id, type: "listing_favourited", channel: "push", enabled: false },
    { userId: person("shira_katz").id, type: "platform_message", channel: "email", enabled: false },
  ];

  // reports
  const reportRows: Insert<typeof reports>[] = [
    {
      reporterId: person("shira_katz").id,
      targetType: "listing",
      targetId: (items.find((i) => i.row.status === "removed") as Item).row.id,
      reason: "counterfeit",
      details: text.reportDetails[0],
      status: "actioned",
      handledById: person("yael.goldberg").id,
      handledAt: ago(2),
      resolutionNote: "Listing removed",
      createdAt: ago(3),
    },
    {
      reporterId: person("emma_j").id,
      targetType: "user",
      targetId: gal.id,
      reason: "spam",
      details: text.reportDetails[1],
      status: "open",
      createdAt: ago(1),
    },
    {
      reporterId: person("lior_azulay").id,
      targetType: "listing",
      targetId: (items.find((i) => i.row.status === "active") as Item).row.id,
      reason: "misleading",
      details: text.reportDetails[2],
      status: "reviewing",
      createdAt: ago(0, 8),
    },
  ];

  // platform message and a saved search match
  notify(noa.id, "platform_message", ago(0, 3), {}, { key: "welcome_back" });
  notify(gal.id, "platform_message", ago(13), {}, { key: "welcome" });
  const dress = items.find(
    (i) => i.categorySlug.startsWith("women-clothing-dresses") && i.row.status === "active",
  );
  if (dress)
    notify(
      noa.id,
      "saved_search_match",
      ago(0, 6),
      { listingId: dress.row.id },
      { query: "שמלה", title: dress.row.title },
    );
  for (const item of live().slice(0, 12)) {
    const fan = people.find(
      (p) => p.id !== item.row.sellerId && followSeen.has(`${p.id}:${item.row.sellerId}`),
    );
    if (fan)
      notify(
        fan.id,
        "followed_seller_new_item",
        item.row.publishedAt as Date,
        { listingId: item.row.id, actorId: item.row.sellerId },
        { title: item.row.title },
      );
  }

  // ----------------------------------------------------- profile numbers
  const memberReviews = new Map<string, { n: number; sum: number }>();
  const autoReviews = new Map<string, { n: number; sum: number }>();
  for (const r of reviewRows) {
    const map = r.isAutomatic ? autoReviews : memberReviews;
    const cur = map.get(r.revieweeId) ?? { n: 0, sum: 0 };
    map.set(r.revieweeId, { n: cur.n + 1, sum: cur.sum + r.rating });
  }
  const followerCount = new Map<string, number>();
  const followingCount = new Map<string, number>();
  for (const f of followRows) {
    followerCount.set(f.followeeId, (followerCount.get(f.followeeId) ?? 0) + 1);
    followingCount.set(f.followerId, (followingCount.get(f.followerId) ?? 0) + 1);
  }
  const profileRows: Insert<typeof profiles>[] = samplePeople.map((sp, i) => {
    const p = people[i] as Person;
    const mine = items.filter((it) => it.row.sellerId === p.id);
    const m = memberReviews.get(p.id);
    const a = autoReviews.get(p.id);
    return {
      userId: p.id,
      bio: p.locale === "he" ? sp.bioHe : sp.bioEn,
      city: p.city,
      countryCode: "IL",
      lastSeenAt: ago(0, rng.int(0, 70)),
      followerCount: followerCount.get(p.id) ?? 0,
      followingCount: followingCount.get(p.id) ?? 0,
      activeListingCount: mine.filter((it) => it.row.status === "active").length,
      soldCount: mine.filter((it) => it.row.status === "sold").length,
      memberReviewCount: m?.n ?? 0,
      memberRatingSum: m?.sum ?? 0,
      automaticReviewCount: a?.n ?? 0,
      automaticRatingSum: a?.sum ?? 0,
      holidayModeEnabled: p.username === "sarah_m",
      holidayStartedAt: p.username === "sarah_m" ? ago(3) : null,
      holidayEndsAt: p.username === "sarah_m" ? ago(-11) : null,
      inviteCode: `${p.username
        .replace(/[^a-z]/g, "")
        .slice(0, 4)
        .toUpperCase()}${rng.int(100, 999)}`,
      createdAt: p.createdAt,
      updatedAt: now,
    };
  });
  const badgeRows: Insert<typeof userBadges>[] = [];
  for (const p of people) {
    const sold = profileRows.find((r) => r.userId === p.id)?.soldCount ?? 0;
    for (const badge of ref.badges) {
      let progress = 0;
      if (badge.slug === "first-sale") progress = Math.min(1, sold);
      else if (badge.slug === "ten-sales") progress = Math.min(badge.target, sold);
      else progress = rng.int(0, badge.target);
      if (progress > 0)
        badgeRows.push({
          userId: p.id,
          badgeId: badge.id,
          progress,
          earnedAt: progress >= badge.target ? ago(rng.int(1, 60)) : null,
        });
    }
  }

  // conversation summaries
  const lastByConv = new Map<string, { at: Date; preview: string | null }>();
  for (const m of msgRows.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())) {
    // Only text has a preview. The app draws photos, offers and dividers from the message kind.
    const preview = m.kind === "text" ? (m.body as string).slice(0, 80) : null;
    lastByConv.set(m.conversationId, { at: m.createdAt as Date, preview });
  }
  for (const conv of convs.values()) {
    const last = lastByConv.get(conv.id);
    if (!last) continue;
    conv.lastMessageAt = last.at;
    conv.lastMessagePreview = last.preview;
    // Some threads have unread messages for the buyer or the seller
    const unread = rng.chance(0.35);
    conv.buyerLastReadAt = unread ? plus(last.at, -120) : last.at;
    conv.sellerLastReadAt = rng.chance(0.3) ? plus(last.at, -90) : last.at;
  }

  // The three people the dev accounts sign in as get a predictable inbox so the app can be tested by hand:
  // their newest chats are unread, their fourth is archived and their fifth is muted.
  const lastFromOther = new Map<string, Date>();
  for (const m of msgRows) {
    lastFromOther.set(`${m.conversationId}:${m.senderId}`, m.createdAt as Date);
  }
  for (const username of ["oliver.smith", "tamar.avraham", "noa_levi"]) {
    const me = people.find((p) => p.username === username);
    if (!me) continue;
    const mine = [...convs.values()]
      .filter((c) => c.buyerId === me.id || c.sellerId === me.id)
      .sort((a, b) => (b.lastMessageAt as Date).getTime() - (a.lastMessageAt as Date).getTime());
    mine.forEach((conv, index) => {
      const asBuyer = conv.buyerId === me.id;
      const otherId = asBuyer ? conv.sellerId : conv.buyerId;
      const theirLast = lastFromOther.get(`${conv.id}:${otherId}`);
      if (index < 2 && theirLast) {
        // Unread: the read marker sits just before the other person's latest message.
        const marker = plus(theirLast, -1);
        if (asBuyer) conv.buyerLastReadAt = marker;
        else conv.sellerLastReadAt = marker;
      }
      if (index === 3) {
        if (asBuyer) conv.buyerArchivedAt = plus(conv.lastMessageAt as Date, 5);
        else conv.sellerArchivedAt = plus(conv.lastMessageAt as Date, 5);
      }
      if (index === 4) {
        if (asBuyer) conv.buyerMutedAt = plus(conv.lastMessageAt as Date, 5);
        else conv.sellerMutedAt = plus(conv.lastMessageAt as Date, 5);
      }
    });
  }

  // ---------------------------------------------------------- write it all
  const listingRows = items.map((i) => i.row);
  await insertChunks((rows) => db.insert(listings).values(rows), listingRows);
  await insertChunks(
    (rows) => db.insert(listingPhotos).values(rows),
    items.flatMap((it) =>
      it.photoKeys.map((key, position) => {
        const [width, height] = photoSizes[key.split("/").pop()?.replace(".jpg", "") ?? ""] ?? [600, 800];
        return { listingId: it.row.id, objectKey: key, width, height, byteSize: 60_000, position };
      }),
    ),
  );
  await insertChunks(
    (rows) => db.insert(listingColours).values(rows),
    items.flatMap((it) =>
      it.colourIds.map((colourId, position) => ({ listingId: it.row.id, colourId, position })),
    ),
  );
  if (priceHistory.length) await db.insert(listingPriceHistory).values(priceHistory);
  if (bumpRows.length) await db.insert(bumps).values(bumpRows);
  await insertChunks((rows) => db.insert(favourites).values(rows), favRows);
  await insertChunks((rows) => db.insert(follows).values(rows), followRows);
  await db.insert(blocks).values(blockRows);
  await insertChunks((rows) => db.insert(userSizes).values(rows), sizeRows);
  await insertChunks((rows) => db.insert(userBrands).values(rows), brandRows);
  await db.insert(savedSearches).values(searchRows);
  await db.insert(recentSearches).values(recentRows);
  await db.insert(bundleDiscountTiers).values(tierRows);
  await db.insert(bundles).values(bundleRows);
  await db.insert(bundleItems).values(bundleItemRows);
  await insertChunks((rows) => db.insert(conversations).values(rows), [...convs.values()]);
  await insertChunks((rows) => db.insert(offers).values(rows), offerRows);
  await db.insert(vouchers).values(voucherRows);
  await insertChunks((rows) => db.insert(orders).values(rows), orderRows);
  await insertChunks((rows) => db.insert(orderItems).values(rows), orderItemRows);
  await insertChunks((rows) => db.insert(orderEvents).values(rows), eventRows);
  await insertChunks((rows) => db.insert(payments).values(rows), paymentRows);
  await insertChunks((rows) => db.insert(shipments).values(rows), shipmentRows);
  await insertChunks((rows) => db.insert(messages).values(rows), msgRows);
  await insertChunks((rows) => db.insert(reviews).values(rows), reviewRows);
  await insertChunks((rows) => db.insert(walletEntries).values(rows), walletRows);
  await insertChunks((rows) => db.insert(notifications).values(rows), notificationRows);
  await db.insert(referrals).values(referralRows);
  await db.insert(reports).values(reportRows);
  await db.insert(pushTokens).values(tokenRows);
  await db.insert(notificationPreferences).values(prefRows);
  await db.insert(profiles).values(profileRows);
  await insertChunks((rows) => db.insert(userBadges).values(rows), badgeRows);

  // One person with clear taste: Noa keeps coming back to Zara dresses
  const asBehaviour = (item: Item) => ({
    id: item.row.id,
    sellerId: item.row.sellerId,
    categoryId: item.row.categoryId ?? null,
    brandId: item.row.brandId ?? null,
    sizeId: item.row.sizeId ?? null,
    conditionId: item.row.conditionId ?? null,
    priceMinor: item.row.priceMinor ?? null,
    colourIds: item.colourIds,
  });
  const noaLikes = zaraNoaLikes.concat(
    items.filter(
      (i) =>
        i.row.brandName === "Zara" &&
        i.categorySlug.startsWith("women-clothing-dresses") &&
        i.row.status === "active" &&
        i.row.sellerId !== noaPerson.id &&
        !zaraNoaLikes.includes(i),
    ),
  );
  const behaviour = await seedBehaviour(db, {
    userId: noaPerson.id,
    now,
    favourite: noaLikes.slice(0, 9).map(asBehaviour),
    glanced: items
      .filter(
        (i) =>
          i.row.status === "active" &&
          !i.categorySlug.startsWith("women-clothing-dresses") &&
          i.row.sellerId !== noaPerson.id,
      )
      .slice(0, 3)
      .map(asBehaviour),
    searchBrandId: zaraId,
    searchCategoryId: noaLikes[0]?.row.categoryId ?? null,
  });

  return {
    users: people.length,
    listings: listingRows.length,
    listing_photos: items.reduce((n, i) => n + i.photoKeys.length, 0),
    favourites: favRows.length,
    follows: followRows.length,
    conversations: convs.size,
    messages: msgRows.length,
    offers: offerRows.length,
    orders: orderRows.length,
    order_events: eventRows.length,
    reviews: reviewRows.length,
    notifications: notificationRows.length,
    wallet_entries: walletRows.length,
    user_events: behaviour.events,
    user_affinities: behaviour.affinities,
  };
}
