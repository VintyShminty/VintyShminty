import { notifications, profiles, reviews, walletEntries } from "@vinty/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishTestListing,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("reviews and balance", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const stamp = Date.now().toString(36);
  let seller: TestPerson;
  let buyer: TestPerson;
  let other: TestPerson;
  const db = () => ctx.database.db;

  /** A finished sale: bought, paid, shipped and received. */
  const completedSale = async (title: string) => {
    const listingId = await publishTestListing(ctx, seller, `Review ${stamp} ${title}`);
    const order = (await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" })).json();
    await call("POST", `/v1/orders/${order.id}/pay`, buyer.token);
    await call("POST", `/v1/orders/${order.id}/ship`, seller.token);
    await call("POST", `/v1/orders/${order.id}/confirm-received`, buyer.token);
    return order.id as string;
  };
  const counters = async (id: string) => {
    const [row] = await db().select().from(profiles).where(eq(profiles.userId, id));
    return row;
  };

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    [seller, buyer, other] = (await Promise.all(
      ["rseller", "rbuyer", "rother"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as TestPerson[];
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("reviews", () => {
    it("is closed until the order is complete", async () => {
      const listingId = await publishTestListing(ctx, seller, `Review ${stamp} early`);
      const order = (await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" })).json();
      const res = await call("POST", `/v1/orders/${order.id}/reviews`, buyer.token, { rating: 5 });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("invalid_transition");
    });

    it("lets a stranger see nothing, and validates the stars and the length", async () => {
      const id = await completedSale("validation");
      expect((await call("POST", `/v1/orders/${id}/reviews`, other.token, { rating: 5 })).statusCode).toBe(404);
      for (const rating of [0, 6, 2.5]) {
        expect((await call("POST", `/v1/orders/${id}/reviews`, buyer.token, { rating })).statusCode).toBe(400);
      }
      const long = await call("POST", `/v1/orders/${id}/reviews`, buyer.token, { rating: 4, comment: "x".repeat(401) });
      expect(long.statusCode).toBe(400);
    });

    it("a buyer's review replaces the automatic one and moves the seller's counters", async () => {
      const id = await completedSale("replace");
      const before = await counters(seller.id);
      const auto = (await call("GET", `/v1/orders/${id}`, buyer.token)).json().reviews.mine;
      expect(auto).toMatchObject({ isAutomatic: true, rating: 5 });

      const res = await call("POST", `/v1/orders/${id}/reviews`, buyer.token, { rating: 3, comment: "  Fits small  " });
      expect(res.statusCode, res.body).toBe(201);
      const review = res.json();
      expect(review).toMatchObject({
        id: auto.id,
        rating: 3,
        comment: "Fits small",
        isAutomatic: false,
        reviewerRole: "buyer",
        orderId: id,
      });
      expect(review.reviewer.id).toBe(buyer.id);
      expect(review.itemTitle).toContain("replace");

      const after = await counters(seller.id);
      expect(after?.automaticReviewCount).toBe((before?.automaticReviewCount ?? 0) - 1);
      expect(after?.automaticRatingSum).toBe((before?.automaticRatingSum ?? 0) - 5);
      expect(after?.memberReviewCount).toBe((before?.memberReviewCount ?? 0) + 1);
      expect(after?.memberRatingSum).toBe((before?.memberRatingSum ?? 0) + 3);

      const [note] = await db()
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, seller.id), eq(notifications.type, "review_received"), eq(notifications.orderId, id)));
      expect(note?.data).toMatchObject({ rating: 3, role: "buyer" });

      // Once per order per side.
      const twice = await call("POST", `/v1/orders/${id}/reviews`, buyer.token, { rating: 5 });
      expect(twice.statusCode).toBe(409);
      expect(twice.json().error.code).toBe("conflict");
      expect((await db().select().from(reviews).where(eq(reviews.orderId, id))).filter((r) => r.reviewerId === buyer.id)).toHaveLength(1);
    });

    it("lets the seller review the buyer once", async () => {
      const id = await completedSale("seller review");
      const res = await call("POST", `/v1/orders/${id}/reviews`, seller.token, { rating: 5, comment: "Fast payer" });
      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).toMatchObject({ reviewerRole: "seller", isAutomatic: false });
      expect((await call("POST", `/v1/orders/${id}/reviews`, seller.token, { rating: 4 })).statusCode).toBe(409);
      const detail = (await call("GET", `/v1/orders/${id}`, buyer.token)).json();
      expect(detail.reviews.theirs).toMatchObject({ rating: 5, comment: "Fast payer" });
      expect(detail.canReview).toBe(true);
      const sellerView = (await call("GET", `/v1/orders/${id}`, seller.token)).json();
      expect(sellerView.canReview).toBe(false);
    });

    it("shows on the seller's profile with the summary the Reviews tab needs", async () => {
      const id = await completedSale("profile");
      await call("POST", `/v1/orders/${id}/reviews`, buyer.token, { rating: 4, comment: "Nice" });
      const page = (await call("GET", `/v1/users/${seller.id}/reviews?source=member`)).json();
      const mine = page.items.find((r: { orderId: string }) => r.orderId === id);
      expect(mine).toMatchObject({ rating: 4, comment: "Nice", isAutomatic: false, reviewerRole: "buyer" });
      expect(page.summary.member.count).toBeGreaterThanOrEqual(1);
      expect(page.summary.total).toBeGreaterThanOrEqual(page.summary.member.count);
      const automatic = (await call("GET", `/v1/users/${seller.id}/reviews?source=automatic`)).json();
      expect(automatic.items.every((r: { isAutomatic: boolean }) => r.isAutomatic)).toBe(true);
    });

    it("lets the reviewed person reply, and nobody else", async () => {
      const id = await completedSale("reply");
      const review = (await call("POST", `/v1/orders/${id}/reviews`, buyer.token, { rating: 2, comment: "Slow" })).json();
      expect((await call("PUT", `/v1/reviews/${review.id}/reply`, buyer.token, { body: "Self" })).statusCode).toBe(404);
      expect((await call("PUT", `/v1/reviews/${review.id}/reply`, other.token, { body: "Hi" })).statusCode).toBe(404);
      expect((await call("PUT", `/v1/reviews/${review.id}/reply`, seller.token, { body: "" })).statusCode).toBe(400);
      const res = await call("PUT", `/v1/reviews/${review.id}/reply`, seller.token, { body: "  Sorry about that  " });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ replyBody: "Sorry about that" });
      expect(res.json().repliedAt).not.toBeNull();
    });

    it("has nothing to reply to on an automatic review", async () => {
      const id = await completedSale("auto reply");
      const [auto] = await db().select().from(reviews).where(eq(reviews.orderId, id));
      const res = await call("PUT", `/v1/reviews/${auto?.id}/reply`, seller.token, { body: "Thanks" });
      expect(res.statusCode).toBe(409);
    });
  });

  describe("balance", () => {
    it("adds up pending and available in minor units", async () => {
      const person = await signUpTestUser(ctx, "rbalance", createdIds);
      const empty = (await call("GET", "/v1/me/balance", person.token)).json();
      expect(empty).toEqual({ pending: 0, available: 0, currency: "ILS" });

      const sale = async (title: string, finish: boolean) => {
        const listingId = await publishTestListing(ctx, person, `Balance ${stamp} ${title}`);
        const order = (await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" })).json();
        await call("POST", `/v1/orders/${order.id}/pay`, buyer.token);
        if (finish) {
          await call("POST", `/v1/orders/${order.id}/ship`, person.token);
          await call("POST", `/v1/orders/${order.id}/confirm-received`, buyer.token);
        }
        return order.id as string;
      };
      await sale("one", true);
      await sale("two", true);
      const waiting = await sale("three", false);
      const cancelled = await sale("four", false);
      await call("POST", `/v1/orders/${cancelled}/cancel`, buyer.token, {});

      const balance = (await call("GET", "/v1/me/balance", person.token)).json();
      expect(balance).toEqual({ pending: 9000, available: 18000, currency: "ILS" });

      const entries = (await call("GET", "/v1/me/balance/entries", person.token)).json();
      expect(entries.items).toHaveLength(4);
      expect(entries.items.map((e: { status: string }) => e.status).sort()).toEqual(["available", "available", "pending", "void"]);
      const first = entries.items[0];
      expect(first.month).toMatch(/^\d{4}-\d{2}$/);
      expect(first.month).toBe(first.createdAt.slice(0, 7));
      expect(entries.items.find((e: { orderId: string }) => e.orderId === waiting).orderNumber).toBeGreaterThanOrEqual(1000);

      const page = (await call("GET", "/v1/me/balance/entries?limit=3", person.token)).json();
      expect(page.items).toHaveLength(3);
      const rest = (await call("GET", `/v1/me/balance/entries?limit=3&cursor=${page.nextCursor}`, person.token)).json();
      expect(rest.items).toHaveLength(1);
      expect(rest.nextCursor).toBeNull();
    });

    it("withdraws pretend money: a negative available row, never more than there is", async () => {
      const person = await signUpTestUser(ctx, "rwithdraw", createdIds);
      const listingId = await publishTestListing(ctx, person, `Withdraw ${stamp}`);
      const order = (await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" })).json();
      await call("POST", `/v1/orders/${order.id}/pay`, buyer.token);
      await call("POST", `/v1/orders/${order.id}/ship`, person.token);
      await call("POST", `/v1/orders/${order.id}/confirm-received`, buyer.token);

      expect((await call("POST", "/v1/me/balance/withdrawals", person.token, { amountMinor: 0 })).statusCode).toBe(400);
      const tooMuch = await call("POST", "/v1/me/balance/withdrawals", person.token, { amountMinor: 9001 });
      expect(tooMuch.statusCode).toBe(400);
      expect(tooMuch.json().error.fields.amountMinor).toBe("validation.withdrawal.tooMuch");

      const res = await call("POST", "/v1/me/balance/withdrawals", person.token, { amountMinor: 3500 }, { "idempotency-key": "withdraw-key-1" });
      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).toMatchObject({ type: "withdrawal", status: "available", amountMinor: -3500 });
      const again = await call("POST", "/v1/me/balance/withdrawals", person.token, { amountMinor: 3500 }, { "idempotency-key": "withdraw-key-1" });
      expect(again.statusCode).toBe(200);
      expect(again.json().id).toBe(res.json().id);
      expect((await call("GET", "/v1/me/balance", person.token)).json()).toEqual({ pending: 0, available: 5500, currency: "ILS" });

      // Two at once cannot overdraw.
      const racing = await Promise.all([
        call("POST", "/v1/me/balance/withdrawals", person.token, { amountMinor: 4000 }),
        call("POST", "/v1/me/balance/withdrawals", person.token, { amountMinor: 4000 }),
      ]);
      expect(racing.map((r) => r.statusCode).sort()).toEqual([201, 400]);
      expect((await call("GET", "/v1/me/balance", person.token)).json().available).toBe(1500);
      const rows = await db().select().from(walletEntries).where(and(eq(walletEntries.userId, person.id), eq(walletEntries.type, "withdrawal")));
      expect(rows).toHaveLength(2);
    });
  });
});
