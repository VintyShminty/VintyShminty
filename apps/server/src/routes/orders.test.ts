import {
  bundleDiscountTiers,
  bundles,
  listings,
  messages,
  notifications,
  orderEvents,
  orders,
  payments,
  shipments,
  users,
  walletEntries,
} from "@vinty/db";
import type { ReferenceData } from "@vinty/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runOrderJobs } from "../lib/order-jobs.js";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishQuietListing,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("checkout and orders", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const stamp = Date.now().toString(36);
  let seller: TestPerson;
  let buyer: TestPerson;
  let other: TestPerson;
  let moderator: TestPerson;
  let postage = 0;
  const db = () => ctx.database.db;

  const newListing = (title: string) => publishQuietListing(ctx, seller, `Order ${stamp} ${title}`);
  const buy = (target: object, token = buyer.token, key?: string) =>
    call(
      "POST",
      "/v1/orders",
      token,
      { deliveryMethod: "pickup_point", ...target },
      key ? { "idempotency-key": key } : {},
    );
  /** A new order for a new listing, created by the buyer. */
  const placed = async (title: string) => {
    const listingId = await newListing(title);
    const res = await buy({ listingId });
    expect(res.statusCode, res.body).toBe(201);
    return { listingId, order: res.json(), id: res.json().id as string };
  };
  const paid = async (title: string) => {
    const made = await placed(title);
    const res = await call("POST", `/v1/orders/${made.id}/pay`, buyer.token);
    expect(res.statusCode, res.body).toBe(200);
    return made;
  };
  const shipped = async (title: string) => {
    const made = await paid(title);
    const res = await call("POST", `/v1/orders/${made.id}/ship`, seller.token);
    expect(res.statusCode, res.body).toBe(200);
    return made;
  };
  const statusOf = async (id: string) =>
    (await db().select().from(orders).where(eq(orders.id, id)))[0]?.status;

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    [seller, buyer, other, moderator] = (await Promise.all(
      ["sseller", "sbuyer", "sother", "smod"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as TestPerson[];
    await db().update(users).set({ role: "moderator" }).where(eq(users.id, moderator.id));
    const reference = (await call("GET", "/v1/reference")).json() as ReferenceData;
    postage = reference.parcelSizes[0]?.priceMinor ?? 0;
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("needs a session for everything", async () => {
    const id = crypto.randomUUID();
    const body = { listingId: id, deliveryMethod: "pickup_point", sellerId: id, details: "x" };
    for (const [method, url] of [
      ["POST", "/v1/checkout/quote"],
      ["POST", "/v1/orders"],
      ["GET", "/v1/orders"],
      ["GET", `/v1/orders/${id}`],
      ["POST", `/v1/orders/${id}/pay`],
      ["POST", `/v1/orders/${id}/ship`],
      ["POST", `/v1/orders/${id}/confirm-received`],
      ["POST", `/v1/orders/${id}/cancel`],
      ["POST", `/v1/orders/${id}/dispute`],
      ["POST", `/v1/orders/${id}/reviews`],
      ["POST", `/v1/admin/orders/${id}/refund`],
      ["POST", `/v1/admin/orders/${id}/release`],
      ["POST", "/v1/bundles"],
      ["GET", "/v1/me/addresses"],
      ["GET", "/v1/me/balance"],
    ] as const) {
      const payload = method === "POST" ? { ...body, rating: 5 } : undefined;
      expect((await call(method, url, undefined, payload)).statusCode, url).toBe(401);
    }
  });

  describe("quote", () => {
    it("shows the price breakdown and reserves nothing", async () => {
      const listingId = await newListing("quote");
      const res = await call("POST", "/v1/checkout/quote", buyer.token, { listingId });
      expect(res.statusCode, res.body).toBe(200);
      const quote = res.json();
      expect(quote).toMatchObject({
        itemsSubtotalMinor: 9000,
        bundleDiscountMinor: 0,
        buyerProtectionFeeMinor: 450,
        shippingMinor: postage,
        voucherDiscountMinor: 0,
        totalMinor: 9000 + 450 + postage,
        currency: "ILS",
        sellerId: seller.id,
        holdMinutes: 30,
        deliveryMethod: "pickup_point",
      });
      expect(quote.items).toHaveLength(1);
      expect(quote.items[0]).toMatchObject({ listingId, priceMinor: 9000 });
      expect(quote.deliveryOptions.map((o: { method: string }) => o.method).sort()).toEqual([
        "home",
        "pickup_point",
      ]);
      const [row] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(row?.status).toBe("active");
    });

    it("needs exactly one target and refuses your own item", async () => {
      const listingId = await newListing("quote errors");
      expect((await call("POST", "/v1/checkout/quote", buyer.token, {})).statusCode).toBe(400);
      expect(
        (await call("POST", "/v1/checkout/quote", buyer.token, { listingId, bundleId: crypto.randomUUID() }))
          .statusCode,
      ).toBe(400);
      expect((await call("POST", "/v1/checkout/quote", seller.token, { listingId })).statusCode).toBe(403);
      expect(
        (await call("POST", "/v1/checkout/quote", buyer.token, { listingId: crypto.randomUUID() }))
          .statusCode,
      ).toBe(404);
    });

    it("uses the agreed price when the quote comes from an accepted offer", async () => {
      const listingId = await newListing("quote offer");
      const chat = (await call("POST", "/v1/conversations", buyer.token, { listingId })).json();
      const offer = (
        await call("POST", `/v1/conversations/${chat.id}/offers`, buyer.token, { amountMinor: 6000 })
      ).json();
      await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
      const quote = (await call("POST", "/v1/checkout/quote", buyer.token, { offerId: offer.id })).json();
      expect(quote.itemsSubtotalMinor).toBe(6000);
      expect(quote.buyerProtectionFeeMinor).toBe(300);
      expect(quote.offerId).toBe(offer.id);
      // Only the buyer of that offer can use it.
      expect((await call("POST", "/v1/checkout/quote", other.token, { offerId: offer.id })).statusCode).toBe(
        404,
      );
    });
  });

  describe("creating an order", () => {
    it("holds the item for 30 minutes and snapshots every number", async () => {
      const { listingId, order } = await placed("create");
      expect(order).toMatchObject({
        role: "buyer",
        status: "pending_payment",
        itemsSubtotalMinor: 9000,
        buyerProtectionFeeMinor: 450,
        shippingMinor: postage,
        totalMinor: 9450 + postage,
        sellerEarningsMinor: null,
        deliveryMethod: "pickup_point",
        shippingAddress: null,
        payment: null,
        shipment: null,
        actions: ["pay", "cancel"],
        canReview: false,
      });
      expect(order.items).toHaveLength(1);
      expect(order.items[0].title).toContain("create");
      expect(order.timeline.map((e: { event: string }) => e.event)).toEqual(["create"]);
      const hold = new Date(order.payByAt).getTime() - Date.now();
      expect(hold).toBeGreaterThan(29 * 60_000);
      expect(hold).toBeLessThanOrEqual(30 * 60_000);

      const [row] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(row).toMatchObject({ status: "reserved", reservedForUserId: buyer.id });
      const [stored] = await db().select().from(orders).where(eq(orders.id, order.id));
      expect(stored).toMatchObject({
        paymentProvider: "simulated",
        shippingProvider: "simulated",
        feeBasisPoints: 500,
      });
    });

    it("gives the same order back for the same key, and for the same item", async () => {
      const listingId = await newListing("repeat");
      const first = await buy({ listingId }, buyer.token, "key-repeat-0001");
      expect(first.statusCode).toBe(201);
      const again = await buy({ listingId }, buyer.token, "key-repeat-0001");
      expect(again.statusCode).toBe(200);
      expect(again.json().id).toBe(first.json().id);
      // No key: opening checkout again for the same item reuses the waiting order, and can change the delivery.
      const reopened = await buy({ listingId, deliveryMethod: "pickup_point" });
      expect(reopened.statusCode).toBe(200);
      expect(reopened.json().id).toBe(first.json().id);
      const mine = await db()
        .select()
        .from(orders)
        .where(and(eq(orders.buyerId, buyer.id), eq(orders.idempotencyKey, "key-repeat-0001")));
      expect(mine).toHaveLength(1);
    });

    it("refuses a second buyer while the item is held", async () => {
      const { listingId } = await placed("taken");
      const res = await buy({ listingId }, other.token);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("listing_unavailable");
    });

    it("needs an address for home delivery and keeps a copy of it", async () => {
      const listingId = await newListing("home");
      const noAddress = await buy({ listingId, deliveryMethod: "home" });
      expect(noAddress.statusCode).toBe(400);
      expect(noAddress.json().error.fields.addressId).toBe("validation.checkout.addressRequired");
      const stranger = await call("POST", "/v1/me/addresses", other.token, {
        fullName: "Not Yours",
        line1: "1 Other St",
        city: "Haifa",
        postcode: "11111",
      });
      const foreign = await buy({ listingId, deliveryMethod: "home", addressId: stranger.json().id });
      expect(foreign.statusCode).toBe(400);

      const address = (
        await call("POST", "/v1/me/addresses", buyer.token, {
          fullName: "Buyer Name",
          line1: "12 Dizengoff",
          city: "Tel Aviv",
          postcode: "6433222",
          phone: "0501234567",
        })
      ).json();
      const res = await buy({ listingId, deliveryMethod: "home", addressId: address.id });
      expect(res.statusCode, res.body).toBe(201);
      expect(res.json().shippingAddress).toMatchObject({
        fullName: "Buyer Name",
        city: "Tel Aviv",
        line1: "12 Dizengoff",
      });
      // Changing the saved address later does not rewrite the order.
      await call("PATCH", `/v1/me/addresses/${address.id}`, buyer.token, { city: "Eilat" });
      const again = (await call("GET", `/v1/orders/${res.json().id}`, buyer.token)).json();
      expect(again.shippingAddress.city).toBe("Tel Aviv");
    });

    it("keeps an unpaid order away from the seller", async () => {
      const { id } = await placed("hidden from seller");
      expect((await call("GET", `/v1/orders/${id}`, seller.token)).statusCode).toBe(404);
      const sold = (await call("GET", "/v1/orders?role=sold", seller.token)).json().items;
      expect(sold.some((o: { id: string }) => o.id === id)).toBe(false);
      expect((await call("POST", `/v1/orders/${id}/cancel`, seller.token, {})).statusCode).toBe(404);
      expect((await call("GET", `/v1/orders/${id}`, other.token)).statusCode).toBe(404);
    });

    it("builds an order from an accepted offer at the agreed price", async () => {
      const listingId = await newListing("from offer");
      const chat = (await call("POST", "/v1/conversations", buyer.token, { listingId })).json();
      const offer = (
        await call("POST", `/v1/conversations/${chat.id}/offers`, buyer.token, { amountMinor: 6000 })
      ).json();
      await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
      const res = await buy({ offerId: offer.id });
      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).toMatchObject({
        offerId: offer.id,
        itemsSubtotalMinor: 6000,
        conversationId: chat.id,
      });
      expect(res.json().items[0].priceMinor).toBe(6000);
    });

    it("refuses an offer that ran out", async () => {
      const listingId = await newListing("late offer");
      const chat = (await call("POST", "/v1/conversations", buyer.token, { listingId })).json();
      const offer = (
        await call("POST", `/v1/conversations/${chat.id}/offers`, buyer.token, { amountMinor: 6000 })
      ).json();
      await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
      const { offers } = await import("@vinty/db");
      await db()
        .update(offers)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(offers.id, offer.id));
      const res = await buy({ offerId: offer.id });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("invalid_transition");
    });
  });

  describe("paying (simulated)", () => {
    it("is only for the buyer, marks the item sold and credits the seller as pending", async () => {
      const { id, listingId } = await placed("pay");
      expect((await call("POST", `/v1/orders/${id}/pay`, other.token)).statusCode).toBe(404);
      const res = await call("POST", `/v1/orders/${id}/pay`, buyer.token, undefined, {
        "idempotency-key": "pay-key-0001",
      });
      expect(res.statusCode, res.body).toBe(200);
      const order = res.json();
      expect(order.status).toBe("paid");
      expect(order.payment).toMatchObject({
        provider: "simulated",
        simulated: true,
        status: "succeeded",
        amountMinor: order.totalMinor,
      });
      expect(order.payByAt).toBeNull();
      expect(new Date(order.shipByAt).getTime() - Date.now()).toBeGreaterThan(4.9 * 86_400_000);
      expect(order.actions).toEqual(["cancel"]);
      expect(order.timeline.map((e: { event: string }) => e.event)).toEqual(["create", "pay"]);

      const [listing] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(listing).toMatchObject({ status: "sold", reservedForUserId: null });
      expect(listing?.soldAt).not.toBeNull();

      const [credit] = await db().select().from(walletEntries).where(eq(walletEntries.orderId, id));
      expect(credit).toMatchObject({
        userId: seller.id,
        type: "sale_credit",
        status: "pending",
        amountMinor: 9000,
      });

      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, seller.id),
            eq(notifications.type, "order_paid"),
            eq(notifications.orderId, id),
          ),
        );
      expect(note?.data).toMatchObject({ amountMinor: 9000, currency: "ILS" });

      const thread = await db().select().from(messages).where(eq(messages.orderId, id));
      expect(thread.map((m) => m.systemEvent)).toEqual(["order_paid"]);

      // The seller can now see it, with what they earn.
      const asSeller = (await call("GET", `/v1/orders/${id}`, seller.token)).json();
      expect(asSeller).toMatchObject({
        role: "seller",
        sellerEarningsMinor: 9000,
        actions: ["ship", "cancel"],
      });
    });

    it("answers a repeat with the paid order and charges nothing twice", async () => {
      const { id } = await placed("pay twice");
      await call("POST", `/v1/orders/${id}/pay`, buyer.token);
      const again = await call("POST", `/v1/orders/${id}/pay`, buyer.token);
      expect(again.statusCode).toBe(200);
      expect(again.json().status).toBe("paid");
      expect(await db().select().from(payments).where(eq(payments.orderId, id))).toHaveLength(1);
      expect(await db().select().from(walletEntries).where(eq(walletEntries.orderId, id))).toHaveLength(1);
    });

    it("cancels a checkout whose hold ran out", async () => {
      const { id, listingId } = await placed("too slow");
      await db()
        .update(orders)
        .set({ payByAt: new Date(Date.now() - 1000) })
        .where(eq(orders.id, id));
      const res = await call("POST", `/v1/orders/${id}/pay`, buyer.token);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("invalid_transition");
      expect(await statusOf(id)).toBe("cancelled");
      const [listing] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(listing?.status).toBe("active");
      const [stored] = await db().select().from(orders).where(eq(orders.id, id));
      expect(stored?.cancelReason).toBe("payment_expired");
    });
  });

  describe("shipping (simulated)", () => {
    it("is only for the seller and gives a fake tracking code", async () => {
      const { id } = await paid("ship");
      expect((await call("POST", `/v1/orders/${id}/ship`, buyer.token)).statusCode).toBe(403);
      expect((await call("POST", `/v1/orders/${id}/ship`, other.token)).statusCode).toBe(404);
      const res = await call("POST", `/v1/orders/${id}/ship`, seller.token);
      expect(res.statusCode, res.body).toBe(200);
      const order = res.json();
      expect(order.status).toBe("shipped");
      expect(order.shipment).toMatchObject({
        provider: "simulated",
        simulated: true,
        status: "in_transit",
        carrier: "Simulated Post",
      });
      expect(order.shipment.trackingCode).toMatch(/^SIM\d{10}$/);
      expect(order.shipByAt).toBeNull();
      const [row] = await db().select().from(shipments).where(eq(shipments.orderId, id));
      expect(row?.provider).toBe("simulated");
      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, buyer.id),
            eq(notifications.type, "order_shipped"),
            eq(notifications.orderId, id),
          ),
        );
      expect(note?.data).toMatchObject({ trackingCode: order.shipment.trackingCode });
    });

    it("cannot be done before payment or twice", async () => {
      const { id } = await placed("ship early");
      // The seller cannot even see an unpaid order.
      expect((await call("POST", `/v1/orders/${id}/ship`, seller.token)).statusCode).toBe(404);
      const made = await shipped("ship twice");
      const again = await call("POST", `/v1/orders/${made.id}/ship`, seller.token);
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe("invalid_transition");
    });
  });

  describe("receiving", () => {
    it("completes, records the delivered step first, releases the credit and leaves the automatic review", async () => {
      const { id } = await shipped("receive");
      expect((await call("POST", `/v1/orders/${id}/confirm-received`, seller.token)).statusCode).toBe(403);
      const res = await call("POST", `/v1/orders/${id}/confirm-received`, buyer.token);
      expect(res.statusCode, res.body).toBe(200);
      const order = res.json();
      expect(order.status).toBe("completed");
      expect(order.timeline.map((e: { event: string }) => e.event)).toEqual([
        "create",
        "pay",
        "ship",
        "deliver",
        "confirm_received",
      ]);
      expect(order.deliveredAt).not.toBeNull();
      expect(order.completedAt).not.toBeNull();
      expect(order.shipment.status).toBe("delivered");
      expect(order.actions).toEqual([]);
      expect(order.canReview).toBe(true);
      expect(order.reviews.mine).toMatchObject({ rating: 5, isAutomatic: true, reviewerRole: "buyer" });

      const [credit] = await db().select().from(walletEntries).where(eq(walletEntries.orderId, id));
      expect(credit).toMatchObject({ status: "available", amountMinor: 9000 });
      expect(credit?.availableAt).not.toBeNull();

      const types = (
        await db()
          .select({ type: notifications.type, userId: notifications.userId })
          .from(notifications)
          .where(eq(notifications.orderId, id))
      ).map((n) => `${n.userId === seller.id ? "seller" : "buyer"}:${n.type}`);
      expect(types).toEqual(
        expect.arrayContaining([
          "seller:order_paid",
          "buyer:order_shipped",
          "seller:order_completed",
          "seller:balance_released",
          "buyer:order_completed",
        ]),
      );
      expect(types).not.toContain("buyer:order_delivered");

      const thread = (await db().select().from(messages).where(eq(messages.orderId, id))).map(
        (m) => m.systemEvent,
      );
      expect(thread).toEqual(
        expect.arrayContaining(["order_paid", "order_shipped", "order_completed", "review_auto_left"]),
      );
      expect(thread).not.toContain("order_delivered");

      // Confirming again is not a move the order can make.
      const twice = await call("POST", `/v1/orders/${id}/confirm-received`, buyer.token);
      expect(twice.statusCode).toBe(409);
    });

    it("also completes a parcel that was delivered first, by the pretend delivery", async () => {
      const { id } = await shipped("delivered first");
      const delivered = await call("POST", `/v1/dev/orders/${id}/deliver`, buyer.token);
      expect(delivered.statusCode, delivered.body).toBe(200);
      expect(delivered.json().status).toBe("delivered");
      expect(new Date(delivered.json().autoCompleteAt).getTime() - Date.now()).toBeGreaterThan(
        47 * 3_600_000,
      );
      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, buyer.id),
            eq(notifications.type, "order_delivered"),
            eq(notifications.orderId, id),
          ),
        );
      expect(note).toBeDefined();
      const done = await call("POST", `/v1/orders/${id}/confirm-received`, buyer.token);
      expect(done.json().status).toBe("completed");
      expect(done.json().timeline.map((e: { event: string }) => e.event)).toEqual([
        "create",
        "pay",
        "ship",
        "deliver",
        "confirm_received",
      ]);
    });
  });

  describe("cancelling", () => {
    it("lets the buyer drop an unpaid order and frees the item", async () => {
      const { id, listingId } = await placed("cancel unpaid");
      const res = await call("POST", `/v1/orders/${id}/cancel`, buyer.token, { reason: "Changed my mind" });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ status: "cancelled", cancelReason: "buyer_cancelled", actions: [] });
      const [listing] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(listing).toMatchObject({ status: "active", reservedForUserId: null });
      // The seller never heard of it.
      const sellerNotes = await db()
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, seller.id), eq(notifications.orderId, id)));
      expect(sellerNotes).toHaveLength(0);
    });

    it("refunds a paid order, voids the credit and tells the seller", async () => {
      const { id, listingId } = await paid("cancel paid");
      const res = await call("POST", `/v1/orders/${id}/cancel`, buyer.token, {});
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("cancelled");
      expect(res.json().payment.status).toBe("refunded");
      const [credit] = await db().select().from(walletEntries).where(eq(walletEntries.orderId, id));
      expect(credit?.status).toBe("void");
      const [listing] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(listing).toMatchObject({ status: "active", soldAt: null });
      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, seller.id),
            eq(notifications.type, "order_cancelled"),
            eq(notifications.orderId, id),
          ),
        );
      expect(note?.data).toMatchObject({ reason: "buyer_cancelled" });
      expect((await call("POST", `/v1/orders/${id}/cancel`, buyer.token, {})).statusCode).toBe(409);
    });

    it("lets the seller cancel a paid order and tells the buyer", async () => {
      const { id } = await paid("seller cancels");
      const res = await call("POST", `/v1/orders/${id}/cancel`, seller.token, {});
      expect(res.statusCode).toBe(200);
      expect(res.json().cancelReason).toBe("seller_cancelled");
      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, buyer.id),
            eq(notifications.type, "order_cancelled"),
            eq(notifications.orderId, id),
          ),
        );
      expect(note).toBeDefined();
    });

    it("is not possible after shipping", async () => {
      const { id } = await shipped("too late to cancel");
      for (const token of [buyer.token, seller.token]) {
        const res = await call("POST", `/v1/orders/${id}/cancel`, token, {});
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe("invalid_transition");
      }
    });
  });

  describe("problems", () => {
    it("lets the buyer report one after shipping, and only the buyer", async () => {
      const { id } = await shipped("dispute");
      expect(
        (await call("POST", `/v1/orders/${id}/dispute`, seller.token, { details: "No" })).statusCode,
      ).toBe(403);
      expect((await call("POST", `/v1/orders/${id}/dispute`, buyer.token, { details: "" })).statusCode).toBe(
        400,
      );
      const res = await call("POST", `/v1/orders/${id}/dispute`, buyer.token, {
        details: "The zip is broken",
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().status).toBe("disputed");
      expect(res.json().timeline.at(-1)).toMatchObject({ event: "open_dispute", note: "The zip is broken" });
      const thread = (await db().select().from(messages).where(eq(messages.orderId, id))).map(
        (m) => m.systemEvent,
      );
      expect(thread).toContain("order_disputed");
    });

    it("closes two days after delivery", async () => {
      const { id } = await shipped("dispute late");
      await call("POST", `/v1/dev/orders/${id}/deliver`, buyer.token);
      await db()
        .update(orders)
        .set({ deliveredAt: new Date(Date.now() - 3 * 86_400_000) })
        .where(eq(orders.id, id));
      const res = await call("POST", `/v1/orders/${id}/dispute`, buyer.token, { details: "Late" });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("invalid_transition");
    });

    it("lets support refund the buyer or release the money to the seller, and nobody else", async () => {
      const refunded = await shipped("admin refund");
      await call("POST", `/v1/orders/${refunded.id}/dispute`, buyer.token, { details: "Broken" });
      expect((await call("POST", `/v1/admin/orders/${refunded.id}/refund`, buyer.token, {})).statusCode).toBe(
        403,
      );
      const res = await call("POST", `/v1/admin/orders/${refunded.id}/refund`, moderator.token, {
        note: "Photos agree",
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().status).toBe("refunded");
      const [credit] = await db().select().from(walletEntries).where(eq(walletEntries.orderId, refunded.id));
      expect(credit?.status).toBe("void");
      const [listing] = await db().select().from(listings).where(eq(listings.id, refunded.listingId));
      expect(listing?.status).toBe("active");

      const released = await shipped("admin release");
      await call("POST", `/v1/orders/${released.id}/dispute`, buyer.token, { details: "Meh" });
      const ok = await call("POST", `/v1/admin/orders/${released.id}/release`, moderator.token, {});
      expect(ok.statusCode).toBe(200);
      expect(ok.json().status).toBe("completed");
      const [paidOut] = await db().select().from(walletEntries).where(eq(walletEntries.orderId, released.id));
      expect(paidOut?.status).toBe("available");
      // An order that is not disputed cannot be resolved.
      const live = await paid("admin wrong state");
      expect((await call("POST", `/v1/admin/orders/${live.id}/refund`, moderator.token, {})).statusCode).toBe(
        409,
      );
    });
  });

  describe("push", () => {
    it("pushes order and offer news in the person's language and opens the right screen", async () => {
      const phone = `ExponentPushToken[orders-${stamp}]`;
      await call("POST", "/v1/me/push-tokens", seller.token, { token: phone, platform: "ios" });
      await call("PATCH", "/v1/me/settings", seller.token, { language: "he" });
      const mine = () => ctx.pusher.sent.filter((m) => m.to === phone);
      const before = mine().length;
      const listingId = await newListing("push");
      const chat = (await call("POST", "/v1/conversations", buyer.token, { listingId })).json();
      await call("POST", `/v1/conversations/${chat.id}/offers`, buyer.token, { amountMinor: 6000 });
      const offerPush = mine().at(-1);
      expect(mine().length).toBe(before + 1);
      expect(offerPush?.data).toMatchObject({ type: "new_offer", conversationId: chat.id, listingId });
      expect(offerPush?.body).toContain("הציע");
      expect(offerPush?.priority).toBe("high");

      await call("PATCH", "/v1/me/settings", seller.token, { language: "en" });
      const order = (
        await call("POST", "/v1/orders", buyer.token, {
          listingId: await newListing("push 2"),
          deliveryMethod: "pickup_point",
        })
      ).json();
      await call("POST", `/v1/orders/${order.id}/pay`, buyer.token);
      const paidPush = mine().at(-1);
      expect(paidPush?.data).toMatchObject({ type: "order_paid", orderId: order.id });
      expect(paidPush?.body).toContain("waiting to be shipped");
    });
  });

  describe("lists", () => {
    it("filters bought and sold orders by status chip and pages through them", async () => {
      const lister = await signUpTestUser(ctx, "slist", createdIds);
      const mk = async (title: string, finish: "pending" | "paid" | "completed" | "cancelled") => {
        const listingId = await publishQuietListing(ctx, seller, `List ${stamp} ${title}`);
        const res = await call("POST", "/v1/orders", lister.token, {
          listingId,
          deliveryMethod: "pickup_point",
        });
        const id = res.json().id as string;
        if (finish !== "pending" && finish !== "cancelled")
          await call("POST", `/v1/orders/${id}/pay`, lister.token);
        if (finish === "completed") {
          await call("POST", `/v1/orders/${id}/ship`, seller.token);
          await call("POST", `/v1/orders/${id}/confirm-received`, lister.token);
        }
        if (finish === "cancelled") await call("POST", `/v1/orders/${id}/cancel`, lister.token, {});
        return id;
      };
      const pending = await mk("a", "pending");
      const inFlight = await mk("b", "paid");
      const done = await mk("c", "completed");
      const gone = await mk("d", "cancelled");

      const ids = async (qs: string, token = lister.token) =>
        ((await call("GET", `/v1/orders?${qs}`, token)).json().items as { id: string }[]).map((o) => o.id);
      expect(await ids("role=bought")).toEqual([gone, done, inFlight, pending]);
      expect((await ids("role=bought&status=in_progress")).sort()).toEqual([inFlight, pending].sort());
      expect(await ids("role=bought&status=completed")).toEqual([done]);
      expect(await ids("role=bought&status=cancelled")).toEqual([gone]);
      expect(await ids("role=sold", lister.token)).toEqual([]);

      const first = (await call("GET", "/v1/orders?role=bought&limit=2", lister.token)).json();
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      const second = (
        await call("GET", `/v1/orders?role=bought&limit=2&cursor=${first.nextCursor}`, lister.token)
      ).json();
      expect([...first.items, ...second.items].map((o: { id: string }) => o.id)).toEqual([
        gone,
        done,
        inFlight,
        pending,
      ]);
      expect(second.nextCursor).toBeNull();

      // The seller's Sold tab holds paid orders only, never the unpaid or cancelled-before-payment ones.
      const sold = await ids(`role=sold&limit=50`, seller.token);
      expect(sold).toEqual(expect.arrayContaining([inFlight, done]));
      expect(sold).not.toContain(pending);
      expect(sold).not.toContain(gone);

      const row = (await call("GET", "/v1/orders?role=bought&status=completed", lister.token)).json()
        .items[0];
      expect(row).toMatchObject({
        role: "buyer",
        status: "completed",
        itemCount: 1,
        sellerEarningsMinor: null,
      });
      expect(row.otherUser.id).toBe(seller.id);
      expect(row.title).toContain("List");
    });
  });

  describe("bundles", () => {
    it("builds a bundle, shows the ladder and checks out at the discount", async () => {
      await db()
        .insert(bundleDiscountTiers)
        .values([
          { sellerId: seller.id, minItems: 2, percentOff: 5 },
          { sellerId: seller.id, minItems: 3, percentOff: 10 },
        ])
        .onConflictDoNothing();
      const a = await newListing("bundle a");
      const b = await newListing("bundle b");
      const c = await newListing("bundle c");

      const created = await call("POST", "/v1/bundles", buyer.token, { sellerId: seller.id });
      expect(created.statusCode).toBe(201);
      const bundle = created.json();
      expect(bundle).toMatchObject({ status: "open", itemCount: 0, discountPercent: 0 });
      expect(bundle.nextTier).toEqual({ addItems: 2, percentOff: 5 });
      const again = await call("POST", "/v1/bundles", buyer.token, { sellerId: seller.id });
      expect(again.statusCode).toBe(200);
      expect(again.json().id).toBe(bundle.id);

      expect((await call("POST", "/v1/bundles", seller.token, { sellerId: seller.id })).statusCode).toBe(403);
      expect((await call("GET", `/v1/bundles/${bundle.id}`, other.token)).statusCode).toBe(404);
      expect((await call("PUT", `/v1/bundles/${bundle.id}/items/${a}`, other.token)).statusCode).toBe(404);

      await call("PUT", `/v1/bundles/${bundle.id}/items/${a}`, buyer.token);
      const two = await call("PUT", `/v1/bundles/${bundle.id}/items/${b}`, buyer.token);
      expect(two.json()).toMatchObject({
        itemCount: 2,
        subtotalMinor: 18000,
        discountPercent: 5,
        discountMinor: 900,
        netMinor: 17100,
      });
      expect(two.json().nextTier).toEqual({ addItems: 1, percentOff: 10 });
      // Adding again changes nothing, and an item from another seller is refused.
      expect((await call("PUT", `/v1/bundles/${bundle.id}/items/${b}`, buyer.token)).json().itemCount).toBe(
        2,
      );
      const foreign = await publishQuietListing(ctx, other, `Foreign ${stamp}`);
      expect((await call("PUT", `/v1/bundles/${bundle.id}/items/${foreign}`, buyer.token)).statusCode).toBe(
        409,
      );

      const three = await call("PUT", `/v1/bundles/${bundle.id}/items/${c}`, buyer.token);
      expect(three.json()).toMatchObject({
        itemCount: 3,
        discountPercent: 10,
        discountMinor: 2700,
        nextTier: null,
      });
      const removed = await call("DELETE", `/v1/bundles/${bundle.id}/items/${c}`, buyer.token);
      expect(removed.json().itemCount).toBe(2);
      await call("PUT", `/v1/bundles/${bundle.id}/items/${c}`, buyer.token);

      const quote = (await call("POST", "/v1/checkout/quote", buyer.token, { bundleId: bundle.id })).json();
      expect(quote).toMatchObject({
        itemsSubtotalMinor: 27000,
        bundleDiscountPercent: 10,
        bundleDiscountMinor: 2700,
        buyerProtectionFeeMinor: 1215,
        shippingMinor: postage,
        totalMinor: 27000 - 2700 + 1215 + postage,
      });
      const order = await buy({ bundleId: bundle.id });
      expect(order.statusCode, order.body).toBe(201);
      expect(order.json().items).toHaveLength(3);
      expect(order.json().bundleId).toBe(bundle.id);
      for (const id of [a, b, c]) {
        const [row] = await db().select().from(listings).where(eq(listings.id, id));
        expect(row?.status).toBe("reserved");
      }

      await call("POST", `/v1/orders/${order.json().id}/pay`, buyer.token);
      for (const id of [a, b, c]) {
        const [row] = await db().select().from(listings).where(eq(listings.id, id));
        expect(row?.status).toBe("sold");
      }
      const [stored] = await db().select().from(bundles).where(eq(bundles.id, bundle.id));
      expect(stored?.status).toBe("ordered");
      const [credit] = await db()
        .select()
        .from(walletEntries)
        .where(eq(walletEntries.orderId, order.json().id));
      expect(credit?.amountMinor).toBe(24300);
      // A closed bundle takes no more items.
      expect((await call("PUT", `/v1/bundles/${bundle.id}/items/${a}`, buyer.token)).statusCode).toBe(409);
    });
  });

  describe("addresses", () => {
    it("saves, defaults, edits and deletes", async () => {
      const person = await signUpTestUser(ctx, "saddr", createdIds);
      const base = { fullName: "A B", line1: "1 Street", city: "Haifa", postcode: "123" };
      const first = (await call("POST", "/v1/me/addresses", person.token, base)).json();
      expect(first.isDefault).toBe(true);
      const second = (
        await call("POST", "/v1/me/addresses", person.token, { ...base, line1: "2 Street" })
      ).json();
      expect(second.isDefault).toBe(false);
      const moved = await call("PATCH", `/v1/me/addresses/${second.id}`, person.token, { isDefault: true });
      expect(moved.json().isDefault).toBe(true);
      const list = (await call("GET", "/v1/me/addresses", person.token)).json();
      expect(list.map((a: { id: string }) => a.id)).toEqual([second.id, first.id]);
      expect(list.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
      expect(
        (await call("PATCH", `/v1/me/addresses/${first.id}`, buyer.token, { city: "X" })).statusCode,
      ).toBe(404);
      expect((await call("DELETE", `/v1/me/addresses/${second.id}`, person.token)).statusCode).toBe(204);
      expect((await call("GET", "/v1/me/addresses", person.token)).json()[0].isDefault).toBe(true);
    });
  });

  describe("background jobs", () => {
    it("cancels unpaid checkouts and unshipped sales, and completes delivered orders", async () => {
      const unpaid = await placed("job unpaid");
      await db()
        .update(orders)
        .set({ payByAt: new Date(Date.now() - 1000) })
        .where(eq(orders.id, unpaid.id));
      const unshipped = await paid("job unshipped");
      await db()
        .update(orders)
        .set({ shipByAt: new Date(Date.now() - 1000) })
        .where(eq(orders.id, unshipped.id));
      const delivered = await shipped("job delivered");
      await call("POST", `/v1/dev/orders/${delivered.id}/deliver`, buyer.token);
      await db()
        .update(orders)
        .set({ autoCompleteAt: new Date(Date.now() - 1000) })
        .where(eq(orders.id, delivered.id));

      const result = await runOrderJobs(ctx.app);
      expect(result.unpaidCancelled).toBeGreaterThanOrEqual(1);
      expect(result.unshippedCancelled).toBeGreaterThanOrEqual(1);
      expect(result.autoCompleted).toBeGreaterThanOrEqual(1);
      const [a] = await db().select().from(orders).where(eq(orders.id, unpaid.id));
      expect(a).toMatchObject({ status: "cancelled", cancelReason: "payment_expired" });
      const [b] = await db().select().from(orders).where(eq(orders.id, unshipped.id));
      expect(b).toMatchObject({ status: "cancelled", cancelReason: "shipping_timeout" });
      const [c] = await db().select().from(orders).where(eq(orders.id, delivered.id));
      expect(c?.status).toBe("completed");
      const events = await db().select().from(orderEvents).where(eq(orderEvents.orderId, delivered.id));
      expect(events.at(-1)).toMatchObject({ event: "auto_complete", actorRole: "system" });
      const [listing] = await db().select().from(listings).where(eq(listings.id, unshipped.listingId));
      expect(listing?.status).toBe("active");
    });

    it("moves a shipped order to delivered after the pretend delay", async () => {
      const made = await shipped("job pretend");
      // No delay configured in tests: nothing happens until the delay is switched on.
      await runOrderJobs(ctx.app);
      expect(await statusOf(made.id)).toBe("shipped");
      const env = ctx.app.env as { SIMULATED_DELIVERY_SECONDS?: number };
      env.SIMULATED_DELIVERY_SECONDS = 1;
      try {
        await db()
          .update(orders)
          .set({ shippedAt: new Date(Date.now() - 5000) })
          .where(eq(orders.id, made.id));
        const result = await runOrderJobs(ctx.app);
        expect(result.pretendDelivered).toBeGreaterThanOrEqual(1);
        expect(await statusOf(made.id)).toBe("delivered");
      } finally {
        env.SIMULATED_DELIVERY_SECONDS = 0;
      }
    });

    it("sends one review reminder two days after completion to each side without feedback", async () => {
      const made = await shipped("job reminder");
      await call("POST", `/v1/orders/${made.id}/confirm-received`, buyer.token);
      await db()
        .update(orders)
        .set({ completedAt: new Date(Date.now() - 3 * 86_400_000) })
        .where(eq(orders.id, made.id));
      await runOrderJobs(ctx.app);
      await runOrderJobs(ctx.app);
      const notes = await db()
        .select()
        .from(notifications)
        .where(and(eq(notifications.orderId, made.id), eq(notifications.type, "review_reminder")));
      expect(notes.map((n) => n.userId).sort()).toEqual([buyer.id, seller.id].sort());
    });
  });
});
