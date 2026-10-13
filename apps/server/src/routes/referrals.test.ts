import { notifications, orders, profiles, referrals, users, vouchers } from "@vinty/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { invitePage } from "../lib/invite-page.js";
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

describe("invite page", () => {
  it("prints a valid code in both languages and never anything else", () => {
    const page = invitePage("k7mq-4xda", "vinty");
    expect(page).toContain('class="code">K7MQ4XDA<');
    expect(page.match(/K7MQ4XDA/g)).toHaveLength(2);
    expect(page).toContain('dir="rtl"');
    for (const hostile of ["<script>alert(1)</script>", "../etc", "ABC", "A".repeat(21), undefined]) {
      expect(invitePage(hostile, "vinty")).not.toContain('class="code"');
    }
  });
});

describe.skipIf(!databaseUrl)("invite friends", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const stamp = Date.now().toString(36);
  let inviter: TestPerson;
  let friend: TestPerson;
  let stranger: TestPerson;
  let seller: TestPerson;
  const db = () => ctx.database.db;

  const completeOrder = async (buyer: TestPerson, title: string, subtotalMinor?: number) => {
    const listingId = await publishQuietListing(ctx, seller, `Invite ${stamp} ${title}`);
    const order = (
      await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" })
    ).json();
    await call("POST", `/v1/orders/${order.id}/pay`, buyer.token);
    await call("POST", `/v1/orders/${order.id}/ship`, seller.token);
    if (subtotalMinor !== undefined) {
      await db().update(orders).set({ itemsSubtotalMinor: subtotalMinor }).where(eq(orders.id, order.id));
    }
    const done = await call("POST", `/v1/orders/${order.id}/confirm-received`, buyer.token);
    expect(done.statusCode).toBe(200);
    return order.id as string;
  };
  const summary = async (p: TestPerson) => (await call("GET", "/v1/me/referral", p.token)).json();

  beforeAll(async () => {
    ctx = await buildTestApp({ BETTER_AUTH_URL: "https://vinty.example.test" });
    call = apiCaller(ctx);
    [inviter, friend, stranger, seller] = (await Promise.all(
      ["inviter", "friend", "stranger", "iseller"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as TestPerson[];
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("needs a login", async () => {
    expect((await call("GET", "/v1/me/referral")).statusCode).toBe(401);
    expect((await call("GET", "/v1/me/vouchers")).statusCode).toBe(401);
    expect((await call("POST", "/v1/referrals/redeem", undefined, { code: "ABCDEFGH" })).statusCode).toBe(
      401,
    );
  });

  it("gives everyone a short code, the same one every time, and a link", async () => {
    const first = await summary(inviter);
    expect(first.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(first.link).toBe(`https://vinty.example.test/invite/${first.inviteCode}`);
    expect(first.rewardMinor).toBe(5000);
    expect(first.referrals).toEqual([]);
    expect(first.vouchers).toEqual([]);
    expect((await summary(inviter)).inviteCode).toBe(first.inviteCode);
    expect((await summary(friend)).inviteCode).not.toBe(first.inviteCode);
  });

  it("makes a code for someone who joined before the feature", async () => {
    await db().update(profiles).set({ inviteCode: null }).where(eq(profiles.userId, stranger.id));
    const made = await summary(stranger);
    expect(made.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });

  it("serves the link page", async () => {
    const { inviteCode } = await summary(inviter);
    const res = await ctx.app.inject({ method: "GET", url: `/invite/${inviteCode}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(inviteCode);
  });

  describe("entering a code", () => {
    it("rejects your own code, an unknown code and a badly shaped one", async () => {
      const { inviteCode } = await summary(inviter);
      expect(
        (await call("POST", "/v1/referrals/redeem", inviter.token, { code: inviteCode })).statusCode,
      ).toBe(400);
      expect(
        (await call("POST", "/v1/referrals/redeem", friend.token, { code: "ZZZZZZZZ" })).statusCode,
      ).toBe(404);
      expect((await call("POST", "/v1/referrals/redeem", friend.token, { code: "abc" })).statusCode).toBe(
        400,
      );
    });

    it("refuses an account older than a week", async () => {
      const { inviteCode } = await summary(inviter);
      await db()
        .update(users)
        .set({ createdAt: new Date(Date.now() - 8 * 86_400_000) })
        .where(eq(users.id, stranger.id));
      const res = await call("POST", "/v1/referrals/redeem", stranger.token, { code: inviteCode });
      expect(res.statusCode).toBe(403);
      expect((await summary(stranger)).canRedeem).toBe(false);
    });

    it("accepts a code in any case with spaces, once", async () => {
      const { inviteCode } = await summary(inviter);
      expect((await summary(friend)).canRedeem).toBe(true);
      const spaced = `${inviteCode.slice(0, 4).toLowerCase()} ${inviteCode.slice(4)}`;
      expect((await call("POST", "/v1/referrals/redeem", friend.token, { code: spaced })).statusCode).toBe(
        204,
      );
      expect(
        (await call("POST", "/v1/referrals/redeem", friend.token, { code: inviteCode })).statusCode,
      ).toBe(409);
      const mine = await summary(inviter);
      expect(mine.referrals).toHaveLength(1);
      expect(mine.referrals[0].status).toBe("pending");
      expect(mine.referrals[0].friend.id).toBe(friend.id);
      const theirs = await summary(friend);
      expect(theirs.invitedBy.id).toBe(inviter.id);
      expect(theirs.canRedeem).toBe(false);
    });
  });

  describe("the reward", () => {
    it("waits for an order that reaches the minimum, then gives both sides a voucher once", async () => {
      // An order under the minimum does not pay out.
      await completeOrder(friend, "small", 1000);
      expect((await summary(inviter)).vouchers).toEqual([]);
      expect((await summary(inviter)).referrals[0].status).toBe("pending");

      await completeOrder(friend, "big");
      const [mine, theirs] = await Promise.all([summary(inviter), summary(friend)]);
      for (const s of [mine, theirs]) {
        expect(s.vouchers).toHaveLength(1);
        expect(s.vouchers[0]).toMatchObject({
          amountMinor: 5000,
          currency: "ILS",
          status: "active",
          minOrderMinor: 5000,
        });
        expect(s.vouchers[0].expiresAt).not.toBeNull();
      }
      expect(mine.referrals[0]).toMatchObject({ status: "rewarded" });
      expect((await call("GET", "/v1/me/vouchers", inviter.token)).json()).toHaveLength(1);

      // Both were told.
      for (const id of [inviter.id, friend.id]) {
        const rows = await db()
          .select()
          .from(notifications)
          .where(and(eq(notifications.userId, id), eq(notifications.type, "referral_rewarded")));
        expect(rows).toHaveLength(1);
      }

      // A later order pays nothing more.
      await completeOrder(friend, "again");
      expect((await summary(inviter)).vouchers).toHaveLength(1);
      expect(await db().select().from(referrals).where(eq(referrals.inviteeId, friend.id))).toHaveLength(1);
    });

    it("pays nothing when the buyer was never invited", async () => {
      await completeOrder(stranger, "plain");
      expect((await summary(stranger)).vouchers).toEqual([]);
      expect(await db().select().from(vouchers).where(eq(vouchers.userId, stranger.id))).toHaveLength(0);
    });
  });
});
