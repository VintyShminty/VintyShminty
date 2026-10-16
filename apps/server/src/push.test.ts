import { notifications, pushTokens } from "@vinty/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notifyUser } from "./lib/notify.js";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishTestListing,
  signUpTestUser,
  type TestContext,
} from "./test-helpers.js";

describe.skipIf(!databaseUrl)("push rules", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  type Person = { token: string; id: string; username: string };
  let seller: Person;
  let buyer: Person;
  let conversationId: string;
  const stamp = Date.now().toString(36);
  const sellerPhone = `ExponentPushToken[seller-${stamp}]`;
  const buyerPhone = `ExponentPushToken[buyer-${stamp}]`;

  const call = (
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    token: string,
    payload?: object,
  ) => ctx.app.inject({ method, url, headers: bearer(token), ...(payload ? { payload } : {}) });
  const say = (from: Person, body = "Hello") =>
    call("POST", `/v1/conversations/${conversationId}/messages`, from.token, {
      kind: "text",
      body,
      clientMessageId: crypto.randomUUID(),
    });
  const settle = () => new Promise((r) => setTimeout(r, 50));
  const resetSettings = async () => {
    await call("PATCH", "/v1/me/settings", seller.token, {
      pushEnabled: true,
      pushDailyLimit: null,
      language: "en",
    });
    await call("PUT", "/v1/me/notification-preferences", seller.token, {
      preferences: [{ type: "new_message", channel: "push", enabled: true }],
    });
    await call("PUT", `/v1/conversations/${conversationId}/mute`, seller.token, { muted: false });
    await ctx.database.db
      .update(pushTokens)
      .set({ revokedAt: null })
      .where(eq(pushTokens.token, sellerPhone));
    await ctx.database.db.delete(notifications).where(eq(notifications.userId, seller.id));
    ctx.pusher.sent.length = 0;
    ctx.pusher.failWith = undefined;
  };

  beforeAll(async () => {
    ctx = await buildTestApp();
    [seller, buyer] = (await Promise.all(
      ["pushseller", "pushbuyer"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as Person[];
    const listing = await publishTestListing(ctx, seller, `Push ${stamp} coat`);
    conversationId = (await call("POST", "/v1/conversations", buyer.token, { listingId: listing })).json().id;
    await call("POST", "/v1/me/push-tokens", seller.token, {
      token: sellerPhone,
      platform: "ios",
      locale: "en",
    });
    await call("POST", "/v1/me/push-tokens", buyer.token, {
      token: buyerPhone,
      platform: "ios",
      locale: "en",
    });
  });

  beforeEach(resetSettings);

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("pushes a new message to the other person's phone only, in their language", async () => {
    await say(buyer, "Is the coat warm?");
    await settle();
    expect(ctx.pusher.sent).toHaveLength(1);
    const push = ctx.pusher.sent[0];
    expect(push?.to).toBe(sellerPhone);
    expect(push?.title).toBe(buyer.username);
    expect(push?.body).toBe("Is the coat warm?");
    expect(push?.priority).toBe("high");
    expect(push?.data).toMatchObject({ type: "new_message", conversationId, userId: buyer.id });

    await call("PATCH", "/v1/me/settings", buyer.token, { language: "he" });
    await call("POST", `/v1/conversations/${conversationId}/messages`, seller.token, {
      kind: "photo",
      attachmentKey: `messages/${seller.id}/p-${stamp}.jpg`,
      clientMessageId: crypto.randomUUID(),
    });
    await settle();
    expect(ctx.pusher.sent[1]?.to).toBe(buyerPhone);
    expect(ctx.pusher.sent[1]?.body).toBe("שלח/ה תמונה");
  });

  it("records the push so the daily limit can count it", async () => {
    await say(buyer);
    await settle();
    const pushed = await ctx.database.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, seller.id), isNotNull(notifications.pushedAt)));
    expect(pushed).toHaveLength(1);
    expect(pushed[0]?.type).toBe("new_message");
  });

  it("groups unread messages of one chat into a single row", async () => {
    await say(buyer, "one");
    await say(buyer, "two");
    await settle();
    const rows = await ctx.database.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, seller.id));
    expect(rows).toHaveLength(1);
    expect((rows[0]?.data as { count?: number } | undefined)?.count).toBe(2);
    expect(ctx.pusher.sent).toHaveLength(2);
  });

  it("sends nothing when the master switch is off", async () => {
    await call("PATCH", "/v1/me/settings", seller.token, { pushEnabled: false });
    await say(buyer);
    await settle();
    expect(ctx.pusher.sent).toHaveLength(0);
  });

  it("sends nothing when that type is switched off", async () => {
    await call("PUT", "/v1/me/notification-preferences", seller.token, {
      preferences: [{ type: "new_message", channel: "push", enabled: false }],
    });
    await say(buyer);
    await settle();
    expect(ctx.pusher.sent).toHaveLength(0);
  });

  it("never pushes (or notes) a muted chat", async () => {
    await call("PUT", `/v1/conversations/${conversationId}/mute`, seller.token, { muted: true });
    await say(buyer);
    await settle();
    expect(ctx.pusher.sent).toHaveLength(0);
    const rows = await ctx.database.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, seller.id));
    expect(rows).toHaveLength(0);
  });

  it("sends nothing to a phone that signed out", async () => {
    await call("DELETE", `/v1/me/push-tokens/${encodeURIComponent(sellerPhone)}`, seller.token);
    await say(buyer);
    await settle();
    expect(ctx.pusher.sent).toHaveLength(0);
  });

  it("forgets a phone Expo says is gone", async () => {
    ctx.pusher.failWith = "deviceGone";
    await say(buyer);
    await settle();
    const [token] = await ctx.database.db.select().from(pushTokens).where(eq(pushTokens.token, sellerPhone));
    expect(token?.revokedAt).not.toBeNull();
  });

  it("stops normal pushes at the daily limit but lets high priority ones through", async () => {
    await call("PATCH", "/v1/me/settings", seller.token, { pushDailyLimit: 2 });
    const favourited = () =>
      notifyUser(ctx.app, {
        userId: seller.id,
        type: "listing_favourited",
        actorId: buyer.id,
        data: { title: "Coat" },
        push: () => ({ title: "Someone hearted your item", body: "Coat" }),
      });
    expect((await favourited()).pushed).toBe(true);
    expect((await favourited()).pushed).toBe(true);
    expect((await favourited()).pushed).toBe(false);
    expect(ctx.pusher.sent).toHaveLength(2);
    expect(ctx.pusher.sent[0]?.priority).toBe("normal");

    await say(buyer, "Still there?");
    await settle();
    expect(ctx.pusher.sent).toHaveLength(3);
    expect(ctx.pusher.sent[2]?.data.type).toBe("new_message");
  });

  it("lets a limit of none send everything", async () => {
    for (let i = 0; i < 4; i++) {
      const res = await notifyUser(ctx.app, {
        userId: seller.id,
        type: "listing_favourited",
        data: {},
        push: () => ({ title: "t", body: "b" }),
      });
      expect(res.pushed).toBe(true);
    }
  });
});
