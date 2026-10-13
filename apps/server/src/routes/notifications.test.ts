import { notifications, pushTokens } from "@vinty/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  signUpTestUser,
  type TestContext,
} from "../test-helpers.js";

describe.skipIf(!databaseUrl)("notifications, unread counts and push tokens", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  type Person = { token: string; id: string; username: string };
  let me: Person;
  let other: Person;
  const stamp = Date.now().toString(36);

  const call = (method: "GET" | "PUT" | "POST" | "DELETE", url: string, token?: string, payload?: object) =>
    ctx.app.inject({ method, url, headers: token ? bearer(token) : {}, ...(payload ? { payload } : {}) });

  beforeAll(async () => {
    ctx = await buildTestApp();
    [me, other] = (await Promise.all(
      ["notifme", "notifother"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as Person[];
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("push tokens", () => {
    const token = `ExponentPushToken[test-${stamp}]`;
    const body = { token, platform: "ios", deviceId: "device-1", locale: "en" };
    const rows = () => ctx.database.db.select().from(pushTokens).where(eq(pushTokens.token, token));

    it("needs a session", async () => {
      expect((await call("POST", "/v1/me/push-tokens", undefined, body)).statusCode).toBe(401);
      expect((await call("DELETE", `/v1/me/push-tokens/${encodeURIComponent(token)}`)).statusCode).toBe(401);
    });

    it("registers a phone once, however often it asks", async () => {
      expect((await call("POST", "/v1/me/push-tokens", me.token, body)).statusCode).toBe(204);
      expect((await call("POST", "/v1/me/push-tokens", me.token, body)).statusCode).toBe(204);
      const saved = await rows();
      expect(saved).toHaveLength(1);
      expect(saved[0]?.userId).toBe(me.id);
    });

    it("rejects a malformed registration", async () => {
      const res = await call("POST", "/v1/me/push-tokens", me.token, { token: "x", platform: "windows" });
      expect(res.statusCode).toBe(400);
    });

    it("ignores a sign out from someone else, then revokes it for the owner", async () => {
      const path = `/v1/me/push-tokens/${encodeURIComponent(token)}`;
      expect((await call("DELETE", path, other.token)).statusCode).toBe(204);
      expect((await rows())[0]?.revokedAt).toBeNull();
      expect((await call("DELETE", path, me.token)).statusCode).toBe(204);
      expect((await rows())[0]?.revokedAt).not.toBeNull();
      expect((await call("DELETE", path, me.token)).statusCode).toBe(204);
    });

    it("hands the phone to the next person who registers it", async () => {
      expect((await call("POST", "/v1/me/push-tokens", other.token, body)).statusCode).toBe(204);
      const saved = await rows();
      expect(saved).toHaveLength(1);
      expect(saved[0]?.userId).toBe(other.id);
      expect(saved[0]?.revokedAt).toBeNull();
    });
  });

  describe("notifications", () => {
    const ids: string[] = [];
    beforeAll(async () => {
      const base = Date.now() - 60_000;
      const inserted = await ctx.database.db
        .insert(notifications)
        .values([
          {
            userId: me.id,
            type: "listing_favourited",
            actorId: other.id,
            data: { title: "A", count: 1 },
            createdAt: new Date(base),
          },
          {
            userId: me.id,
            type: "new_follower",
            actorId: other.id,
            data: {},
            createdAt: new Date(base + 1000),
          },
          {
            userId: me.id,
            type: "platform_message",
            data: { key: "welcome" },
            createdAt: new Date(base + 2000),
          },
          // Push bookkeeping rows never show up in the tab or its dot.
          {
            userId: me.id,
            type: "new_message",
            actorId: other.id,
            data: { count: 3 },
            createdAt: new Date(base + 3000),
          },
          { userId: other.id, type: "new_follower", actorId: me.id, data: {}, createdAt: new Date(base) },
        ])
        .returning({ id: notifications.id });
      ids.push(...inserted.map((r) => r.id));
    });

    it("lists newest first with the actor, and hides new message rows", async () => {
      const res = await call("GET", "/v1/me/notifications", me.token);
      expect(res.statusCode).toBe(200);
      const items = res.json().items as {
        type: string;
        actor: { id: string } | null;
        readAt: string | null;
      }[];
      expect(items.map((n) => n.type)).toEqual(["platform_message", "new_follower", "listing_favourited"]);
      expect(items[1]?.actor?.id).toBe(other.id);
      expect(items[0]?.actor).toBeNull();
    });

    it("pages by cursor", async () => {
      const first = (await call("GET", "/v1/me/notifications?limit=2", me.token)).json();
      expect(first.items).toHaveLength(2);
      const second = (
        await call(
          "GET",
          `/v1/me/notifications?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`,
          me.token,
        )
      ).json();
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
    });

    it("counts unread ones and marks some or all as read", async () => {
      expect((await call("GET", "/v1/me/unread", me.token)).json().notifications).toBe(3);
      const first = ids[0] as string;
      expect((await call("POST", "/v1/me/notifications/read", me.token, { ids: [first] })).statusCode).toBe(
        204,
      );
      expect((await call("GET", "/v1/me/unread", me.token)).json().notifications).toBe(2);

      // Someone else's id changes nothing.
      const theirs = ids[4] as string;
      await call("POST", "/v1/me/notifications/read", me.token, { ids: [theirs] });
      expect((await call("GET", "/v1/me/unread", other.token)).json().notifications).toBe(1);

      expect((await call("POST", "/v1/me/notifications/read", me.token, {})).statusCode).toBe(204);
      expect((await call("GET", "/v1/me/unread", me.token)).json().notifications).toBe(0);
      const items = (await call("GET", "/v1/me/notifications", me.token)).json().items as {
        readAt: string | null;
      }[];
      expect(items.every((n) => n.readAt !== null)).toBe(true);
    });

    it("rejects a bad ids list", async () => {
      expect((await call("POST", "/v1/me/notifications/read", me.token, { ids: [] })).statusCode).toBe(400);
      expect((await call("POST", "/v1/me/notifications/read", me.token, { ids: ["nope"] })).statusCode).toBe(
        400,
      );
    });
  });
});
