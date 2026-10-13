import { conversations, listings, messages, notifications, offers } from "@vinty/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expireOffer } from "../lib/offers.js";
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
describe.skipIf(!databaseUrl)("offers", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const stamp = Date.now().toString(36);
  let seller: TestPerson;
  let buyer: TestPerson;
  let other: TestPerson;

  /** A fresh listing and a chat between the buyer and the seller about it. */
  const chatAbout = async (title: string, who: TestPerson = buyer) => {
    const listingId = await publishQuietListing(ctx, seller, `Offer ${stamp} ${title}`);
    const res = await call("POST", "/v1/conversations", who.token, { listingId });
    return { listingId, conversationId: res.json().id as string };
  };
  const offerOn = (conversationId: string, amountMinor: number, token = buyer.token) =>
    call("POST", `/v1/conversations/${conversationId}/offers`, token, { amountMinor });
  const db = () => ctx.database.db;

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    [seller, buyer, other] = (await Promise.all(
      ["oseller", "obuyer", "oother"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as TestPerson[];
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("needs a session for everything", async () => {
    expect((await call("GET", "/v1/offers/quota")).statusCode).toBe(401);
    const id = crypto.randomUUID();
    expect(
      (await call("POST", `/v1/conversations/${id}/offers`, undefined, { amountMinor: 100 })).statusCode,
    ).toBe(401);
    for (const action of ["accept", "decline", "withdraw"]) {
      expect((await call("POST", `/v1/offers/${id}/${action}`)).statusCode).toBe(401);
    }
    expect((await call("POST", `/v1/offers/${id}/counter`, undefined, { amountMinor: 100 })).statusCode).toBe(
      401,
    );
  });

  describe("sending", () => {
    it("starts with the full daily allowance", async () => {
      const quota = (await call("GET", "/v1/offers/quota", buyer.token)).json();
      expect(quota.limit).toBe(15);
      expect(quota.remaining).toBe(15);
      expect(new Date(quota.resetsAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("makes an offer, writes the bubble, tells the seller and uses one of the day's offers", async () => {
      const { listingId, conversationId } = await chatAbout("first");
      const res = await offerOn(conversationId, 7000);
      expect(res.statusCode, res.body).toBe(201);
      const offer = res.json();
      expect(offer).toMatchObject({
        conversationId,
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        offeredById: buyer.id,
        parentOfferId: null,
        amountMinor: 7000,
        listingPriceMinor: 9000,
        status: "pending",
        reservedUntil: null,
      });

      const thread = (await call("GET", `/v1/conversations/${conversationId}/messages`, seller.token)).json();
      const bubble = thread.items.find((m: { kind: string }) => m.kind === "offer");
      expect(bubble.offer).toMatchObject({
        id: offer.id,
        amountMinor: 7000,
        status: "pending",
        offeredById: buyer.id,
      });
      expect(bubble.senderId).toBe(buyer.id);

      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, seller.id),
            eq(notifications.type, "new_offer"),
            eq(notifications.conversationId, conversationId),
          ),
        );
      expect(note?.data).toMatchObject({ offerId: offer.id, amountMinor: 7000, listingPriceMinor: 9000 });

      expect((await call("GET", "/v1/offers/quota", buyer.token)).json().remaining).toBe(14);
    });

    it("refuses an amount that is zero, equal to the price or above it", async () => {
      const { conversationId } = await chatAbout("amounts");
      for (const amountMinor of [0, -5]) {
        expect((await offerOn(conversationId, amountMinor)).statusCode).toBe(400);
      }
      for (const amountMinor of [9000, 9001, 20000]) {
        const res = await offerOn(conversationId, amountMinor);
        expect(res.statusCode).toBe(400);
        expect(res.json().error.fields.amountMinor).toBe("validation.offer.belowPrice");
      }
      expect((await offerOn(conversationId, 1)).statusCode).toBe(201);
    });

    it("keeps one pending offer per conversation", async () => {
      const { conversationId } = await chatAbout("one pending");
      expect((await offerOn(conversationId, 5000)).statusCode).toBe(201);
      const again = await offerOn(conversationId, 6000);
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe("conflict");
    });

    it("lets only the buyer start an offer, and only people in the chat see it", async () => {
      const { conversationId } = await chatAbout("parties");
      const own = await offerOn(conversationId, 5000, seller.token);
      expect(own.statusCode).toBe(403);
      expect((await offerOn(conversationId, 5000, other.token)).statusCode).toBe(404);
    });

    it("refuses an item that is sold or held for someone else", async () => {
      const { listingId, conversationId } = await chatAbout("held");
      await db()
        .update(listings)
        .set({ status: "reserved", reservedForUserId: other.id })
        .where(eq(listings.id, listingId));
      const res = await offerOn(conversationId, 5000);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("listing_unavailable");
    });

    it("stops at the daily limit with a 429, a Retry-After and the time it frees up", async () => {
      const limited = await signUpTestUser(ctx, "olimited", createdIds);
      const { listingId, conversationId } = await chatAbout("limit", limited);
      const rows = Array.from({ length: 15 }, () => ({
        conversationId,
        listingId,
        buyerId: limited.id,
        sellerId: seller.id,
        offeredById: limited.id,
        amountMinor: 100,
        listingPriceMinor: 9000,
        status: "declined" as const,
        expiresAt: new Date(Date.now() + 3_600_000),
      }));
      await db().insert(offers).values(rows);
      expect((await call("GET", "/v1/offers/quota", limited.token)).json().remaining).toBe(0);
      const res = await offerOn(conversationId, 5000, limited.token);
      expect(res.statusCode).toBe(429);
      expect(res.json().error.code).toBe("offer_limit_reached");
      expect(new Date(res.json().error.resetsAt).getTime()).toBeGreaterThan(Date.now());
      expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("refuses when one side blocked the other", async () => {
      const { blocks } = await import("@vinty/db");
      const { conversationId } = await chatAbout("blocked");
      await db().insert(blocks).values({ blockerId: seller.id, blockedId: buyer.id });
      const res = await offerOn(conversationId, 5000);
      await db().delete(blocks).where(eq(blocks.blockerId, seller.id));
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("blocked");
    });
  });

  describe("answering", () => {
    it("accept reserves the item for the buyer and updates the bubble", async () => {
      const { listingId, conversationId } = await chatAbout("accept");
      const offer = (await offerOn(conversationId, 7000)).json();

      const byBuyer = await call("POST", `/v1/offers/${offer.id}/accept`, buyer.token);
      expect(byBuyer.statusCode).toBe(403);
      expect((await call("POST", `/v1/offers/${offer.id}/accept`, other.token)).statusCode).toBe(404);

      const res = await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
      expect(res.statusCode, res.body).toBe(200);
      const accepted = res.json();
      expect(accepted.status).toBe("accepted");
      const hold = new Date(accepted.reservedUntil).getTime() - Date.now();
      expect(hold).toBeGreaterThan(23.9 * 3_600_000);
      expect(hold).toBeLessThanOrEqual(24 * 3_600_000);

      const [listing] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(listing).toMatchObject({ status: "reserved", reservedForUserId: buyer.id });

      const thread = (await call("GET", `/v1/conversations/${conversationId}/messages`, buyer.token)).json()
        .items;
      expect(thread.find((m: { kind: string }) => m.kind === "offer").offer.status).toBe("accepted");
      expect(thread.some((m: { systemEvent: string }) => m.systemEvent === "offer_accepted")).toBe(true);

      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, buyer.id),
            eq(notifications.type, "offer_accepted"),
            eq(notifications.listingId, listingId),
          ),
        );
      expect(note?.data).toMatchObject({ offerId: offer.id, amountMinor: 7000 });

      const again = await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe("invalid_transition");

      // The held item shows on the item page as reserved, and only the buyer can still buy it.
      const asBuyer = (await call("GET", `/v1/listings/${listingId}`, buyer.token)).json();
      expect(asBuyer.status).toBe("reserved");
      expect(asBuyer.viewer.canBuy).toBe(true);
      const asOther = (await call("GET", `/v1/listings/${listingId}`, other.token)).json();
      expect(asOther.viewer.canBuy).toBe(false);
    });

    it("decline closes the offer and lets the buyer try again", async () => {
      const { conversationId } = await chatAbout("decline");
      const offer = (await offerOn(conversationId, 4000)).json();
      expect((await call("POST", `/v1/offers/${offer.id}/decline`, buyer.token)).statusCode).toBe(403);
      const res = await call("POST", `/v1/offers/${offer.id}/decline`, seller.token);
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("declined");
      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, buyer.id),
            eq(notifications.type, "offer_declined"),
            eq(notifications.conversationId, conversationId),
          ),
        );
      expect(note).toBeDefined();
      expect((await offerOn(conversationId, 5000)).statusCode).toBe(201);
    });

    it("counter flips the sides: the old offer is countered and the new one waits for the other person", async () => {
      const { listingId, conversationId } = await chatAbout("counter");
      const offer = (await offerOn(conversationId, 5000)).json();
      const before = (await call("GET", "/v1/offers/quota", buyer.token)).json().remaining;

      expect(
        (await call("POST", `/v1/offers/${offer.id}/counter`, buyer.token, { amountMinor: 6000 })).statusCode,
      ).toBe(403);
      expect(
        (await call("POST", `/v1/offers/${offer.id}/counter`, seller.token, { amountMinor: 9000 }))
          .statusCode,
      ).toBe(400);

      const res = await call("POST", `/v1/offers/${offer.id}/counter`, seller.token, { amountMinor: 8000 });
      expect(res.statusCode, res.body).toBe(201);
      const counter = res.json();
      expect(counter).toMatchObject({
        parentOfferId: offer.id,
        offeredById: seller.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amountMinor: 8000,
        status: "pending",
      });
      const [old] = await db().select().from(offers).where(eq(offers.id, offer.id));
      expect(old?.status).toBe("countered");
      // A seller's counter is not one of the buyer's daily offers.
      expect((await call("GET", "/v1/offers/quota", buyer.token)).json().remaining).toBe(before);

      // The seller cannot accept their own counter, the buyer can.
      expect((await call("POST", `/v1/offers/${counter.id}/accept`, seller.token)).statusCode).toBe(403);
      const accepted = await call("POST", `/v1/offers/${counter.id}/accept`, buyer.token);
      expect(accepted.statusCode, accepted.body).toBe(200);
      const [listing] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(listing?.status).toBe("reserved");

      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, buyer.id),
            eq(notifications.type, "offer_countered"),
            eq(notifications.conversationId, conversationId),
          ),
        );
      expect(note?.data).toMatchObject({ amountMinor: 8000 });
    });

    it("a buyer who counters a counter spends one of their offers", async () => {
      const { conversationId } = await chatAbout("counter back");
      const offer = (await offerOn(conversationId, 5000)).json();
      const counter = (
        await call("POST", `/v1/offers/${offer.id}/counter`, seller.token, { amountMinor: 8000 })
      ).json();
      const before = (await call("GET", "/v1/offers/quota", buyer.token)).json().remaining;
      const back = await call("POST", `/v1/offers/${counter.id}/counter`, buyer.token, { amountMinor: 6500 });
      expect(back.statusCode, back.body).toBe(201);
      expect(back.json().offeredById).toBe(buyer.id);
      expect((await call("GET", "/v1/offers/quota", buyer.token)).json().remaining).toBe(before - 1);
    });

    it("withdraw is for the person who made the offer", async () => {
      const { conversationId } = await chatAbout("withdraw");
      const offer = (await offerOn(conversationId, 4500)).json();
      expect((await call("POST", `/v1/offers/${offer.id}/withdraw`, seller.token)).statusCode).toBe(403);
      const res = await call("POST", `/v1/offers/${offer.id}/withdraw`, buyer.token);
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("withdrawn");
      expect((await call("POST", `/v1/offers/${offer.id}/withdraw`, buyer.token)).statusCode).toBe(409);
    });
  });

  describe("expiry", () => {
    it("a pending offer past its time cannot be answered and is marked expired", async () => {
      const { conversationId } = await chatAbout("late");
      const offer = (await offerOn(conversationId, 5000)).json();
      await db()
        .update(offers)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(offers.id, offer.id));
      const res = await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("invalid_transition");
      const [row] = await db().select().from(offers).where(eq(offers.id, offer.id));
      expect(row?.status).toBe("expired");
      const sys = await db()
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.systemEvent, "offer_expired")));
      expect(sys).toHaveLength(1);
      const [note] = await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, buyer.id),
            eq(notifications.type, "offer_expired"),
            eq(notifications.conversationId, conversationId),
          ),
        );
      expect(note).toBeDefined();
    });

    it("an accepted offer that is not checked out in time frees the item", async () => {
      const { listingId, conversationId } = await chatAbout("hold ran out");
      const offer = (await offerOn(conversationId, 5000)).json();
      await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
      await db()
        .update(offers)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(offers.id, offer.id));
      expect(await expireOffer(ctx.app, offer.id)).toBe(true);
      const [row] = await db().select().from(offers).where(eq(offers.id, offer.id));
      expect(row?.status).toBe("expired");
      const [listing] = await db().select().from(listings).where(eq(listings.id, listingId));
      expect(listing).toMatchObject({ status: "active", reservedForUserId: null, reservedUntil: null });
    });

    it("does not expire an offer that is still running", async () => {
      const { conversationId } = await chatAbout("running");
      const offer = (await offerOn(conversationId, 5000)).json();
      expect(await expireOffer(ctx.app, offer.id)).toBe(false);
    });
  });

  it("keeps the chat row pointing at the newest event", async () => {
    const { conversationId } = await chatAbout("inbox");
    await offerOn(conversationId, 5000);
    const list = (await call("GET", "/v1/conversations", seller.token)).json().items;
    const row = list.find((c: { id: string }) => c.id === conversationId);
    expect(row.lastMessageKind).toBe("offer");
    expect(row.unread).toBe(true);
    const [chat] = await db().select().from(conversations).where(eq(conversations.id, conversationId));
    expect(chat).toBeDefined();
  });
});
