import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishTestListing,
  signUpTestUser,
  type TestContext,
} from "./test-helpers.js";

describe.skipIf(!databaseUrl)("socket layer", () => {
  let ctx: TestContext;
  let url: string;
  const createdIds: string[] = [];
  type Person = { token: string; id: string; username: string };
  let seller: Person;
  let buyer: Person;
  let stranger: Person;
  let conversationId: string;
  const open: Socket[] = [];
  const stamp = Date.now().toString(36);

  const connectAs = (token: string | undefined) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = connect(url, {
        transports: ["websocket"],
        auth: token === undefined ? {} : { token },
        reconnection: false,
      });
      open.push(socket);
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err) => reject(err));
    });
  /** Collects every event of one name a socket receives. */
  const collect = <T>(socket: Socket, event: string) => {
    const seen: T[] = [];
    socket.on(event, (payload: T) => seen.push(payload));
    return seen;
  };
  const until = async (check: () => boolean, ms = 3000) => {
    const start = Date.now();
    while (!check()) {
      if (Date.now() - start > ms) throw new Error("Timed out waiting for a socket event");
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const pause = (ms = 250) => new Promise((r) => setTimeout(r, ms));
  const ask = <T>(socket: Socket, event: string, payload: object) =>
    new Promise<T>((resolve) => socket.emit(event, payload, resolve));
  const post = (token: string, body: string, clientMessageId = crypto.randomUUID()) =>
    ctx.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: bearer(token),
      payload: { kind: "text", body, clientMessageId },
    });

  beforeAll(async () => {
    ctx = await buildTestApp();
    await ctx.app.listen({ port: 0, host: "127.0.0.1" });
    url = `http://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;
    [seller, buyer, stranger] = (await Promise.all(
      ["rtseller", "rtbuyer", "rtstranger"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as Person[];
    const listing = await publishTestListing(ctx, seller, `Socket ${stamp} dress`);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/conversations",
      headers: bearer(buyer.token),
      payload: { listingId: listing },
    });
    conversationId = res.json().id;
    await ctx.app.inject({
      method: "POST",
      url: "/v1/me/push-tokens",
      headers: bearer(seller.token),
      payload: { token: `ExponentPushToken[rt-${stamp}]`, platform: "ios" },
    });
  });

  afterEach(() => {
    for (const s of open.splice(0)) s.close();
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("handshake", () => {
    it("rejects a missing, empty or wrong token", async () => {
      await expect(connectAs(undefined)).rejects.toThrow("unauthenticated");
      await expect(connectAs("")).rejects.toThrow("unauthenticated");
      await expect(connectAs("not-a-real-token")).rejects.toThrow("unauthenticated");
    });

    it("accepts a session token and sends the unread counts straight away", async () => {
      const socket = await new Promise<Socket>((resolve, reject) => {
        const s = connect(url, {
          transports: ["websocket"],
          auth: { token: seller.token },
          reconnection: false,
        });
        open.push(s);
        s.on("unread:count", () => resolve(s));
        s.on("connect_error", reject);
      });
      expect(socket.connected).toBe(true);
    });
  });

  describe("messages", () => {
    it("reaches both people's rooms and never a stranger", async () => {
      const [sellerSocket, buyerSocket, strangerSocket] = await Promise.all([
        connectAs(seller.token),
        connectAs(buyer.token),
        connectAs(stranger.token),
      ]);
      const toSeller = collect<{ conversationId: string; message: { body: string } }>(
        sellerSocket,
        "message:new",
      );
      const toBuyer = collect<{ message: { body: string } }>(buyerSocket, "message:new");
      const toStranger = collect(strangerSocket, "message:new");
      const strangerAny: unknown[] = [];
      for (const event of ["conversation:updated", "unread:count", "notification:new", "conversation:read"]) {
        strangerSocket.on(event, (p) => strangerAny.push(p));
      }
      const updates = collect<{ conversationId: string; unread: boolean; lastMessagePreview: string }>(
        sellerSocket,
        "conversation:updated",
      );
      const counts = collect<{ messages: number }>(sellerSocket, "unread:count");
      await pause(100);
      strangerAny.length = 0;
      counts.length = 0;

      const res = await post(buyer.token, "Hello over the wire");
      expect(res.statusCode).toBe(201);
      await until(() => toSeller.length > 0 && updates.length > 0 && counts.length > 0);
      expect(toSeller[0]?.message.body).toBe("Hello over the wire");
      expect(toSeller[0]?.conversationId).toBe(conversationId);
      // The sender's own devices hear it too, so a second phone stays in step.
      await until(() => toBuyer.length > 0);
      expect(updates[0]).toMatchObject({
        conversationId,
        unread: true,
        lastMessagePreview: "Hello over the wire",
      });
      expect(counts.at(-1)?.messages).toBeGreaterThanOrEqual(1);

      await pause();
      expect(toStranger).toHaveLength(0);
      expect(strangerAny).toHaveLength(0);
    });

    it("lets a party join the thread and refuses a stranger", async () => {
      const buyerSocket = await connectAs(buyer.token);
      const strangerSocket = await connectAs(stranger.token);
      expect(await ask(buyerSocket, "conversation:join", { conversationId })).toEqual({ ok: true });
      expect(await ask(strangerSocket, "conversation:join", { conversationId })).toMatchObject({
        ok: false,
        code: "not_found",
      });
      expect(await ask(buyerSocket, "conversation:join", { conversationId: "nope" })).toMatchObject({
        ok: false,
        code: "validation_failed",
      });
    });

    it("sends over the socket, safely retried", async () => {
      const sellerSocket = await connectAs(seller.token);
      const buyerSocket = await connectAs(buyer.token);
      const got = collect<{ message: { id: string } }>(buyerSocket, "message:new");
      const clientMessageId = crypto.randomUUID();
      const payload = { conversationId, kind: "text", body: "Via socket", clientMessageId };
      const first = await ask<{ ok: boolean; message: { id: string } }>(
        sellerSocket,
        "message:send",
        payload,
      );
      const retry = await ask<{ ok: boolean; message: { id: string } }>(
        sellerSocket,
        "message:send",
        payload,
      );
      expect(first.ok).toBe(true);
      expect(retry.message.id).toBe(first.message.id);
      await until(() => got.length > 0);
      await pause();
      expect(got).toHaveLength(1);
    });

    it("refuses a stranger sending and a bad payload", async () => {
      const strangerSocket = await connectAs(stranger.token);
      const refused = await ask(strangerSocket, "message:send", {
        conversationId,
        kind: "text",
        body: "hi",
        clientMessageId: crypto.randomUUID(),
      });
      expect(refused).toMatchObject({ ok: false, code: "not_found" });
      const bad = await ask(strangerSocket, "message:send", { conversationId, kind: "text" });
      expect(bad).toMatchObject({ ok: false, code: "validation_failed" });
    });

    it("moves the read marker and tells the thread", async () => {
      const sellerSocket = await connectAs(seller.token);
      const buyerSocket = await connectAs(buyer.token);
      await ask(buyerSocket, "conversation:join", { conversationId });
      const receipts = collect<{ userId: string }>(buyerSocket, "conversation:read");
      await post(buyer.token, "Did you see this?");
      const result = await ask(sellerSocket, "conversation:read", { conversationId });
      expect(result).toEqual({ ok: true });
      await until(() => receipts.length > 0);
      expect(receipts[0]?.userId).toBe(seller.id);
      const unread = await ctx.app.inject({
        method: "GET",
        url: "/v1/me/unread",
        headers: bearer(seller.token),
      });
      expect(unread.json().messages).toBe(0);
    });
  });

  describe("typing", () => {
    it("reaches the other person in the thread, throttled, never a stranger", async () => {
      const sellerSocket = await connectAs(seller.token);
      const buyerSocket = await connectAs(buyer.token);
      const strangerSocket = await connectAs(stranger.token);
      await ask(sellerSocket, "conversation:join", { conversationId });
      await ask(buyerSocket, "conversation:join", { conversationId });
      await ask(strangerSocket, "conversation:join", { conversationId });
      const seen = collect<{ userId: string; isTyping: boolean }>(buyerSocket, "typing");
      const strangerSeen = collect(strangerSocket, "typing");

      sellerSocket.emit("typing", { conversationId, isTyping: true });
      sellerSocket.emit("typing", { conversationId, isTyping: true });
      sellerSocket.emit("typing", { conversationId, isTyping: true });
      await until(() => seen.length > 0);
      await pause();
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ userId: seller.id, isTyping: true });

      sellerSocket.emit("typing", { conversationId, isTyping: false });
      await until(() => seen.length === 2);
      expect(seen[1]?.isTyping).toBe(false);
      expect(strangerSeen).toHaveLength(0);
    });

    it("ignores typing from someone who has not joined", async () => {
      const sellerSocket = await connectAs(seller.token);
      const buyerSocket = await connectAs(buyer.token);
      await ask(buyerSocket, "conversation:join", { conversationId });
      const seen = collect(buyerSocket, "typing");
      sellerSocket.emit("typing", { conversationId, isTyping: true });
      await pause();
      expect(seen).toHaveLength(0);
    });
  });

  describe("hearts", () => {
    it("tell the seller's open app at once, grouped by item", async () => {
      const listing = await publishTestListing(ctx, seller, `Heart ${stamp} scarf`);
      const sellerSocket = await connectAs(seller.token);
      const seen = collect<{ notification: { type: string; listingId: string; data: { count: number } } }>(
        sellerSocket,
        "notification:new",
      );
      const heart = (token: string) =>
        ctx.app.inject({ method: "PUT", url: `/v1/listings/${listing}/favourite`, headers: bearer(token) });
      expect((await heart(buyer.token)).statusCode).toBe(200);
      await until(() => seen.length === 1);
      expect(seen[0]?.notification).toMatchObject({ type: "listing_favourited", listingId: listing });
      expect(seen[0]?.notification.data.count).toBe(1);

      // A second heart raises the same row and tells the app again.
      expect((await heart(stranger.token)).statusCode).toBe(200);
      await until(() => seen.length === 2);
      expect(seen[1]?.notification.data.count).toBe(2);
      // Hearting again changes nothing and says nothing.
      await heart(stranger.token);
      await pause(150);
      expect(seen).toHaveLength(2);
    });
  });

  describe("push when the thread is open", () => {
    it("pushes while the recipient is not looking, and not while they are", async () => {
      ctx.pusher.sent.length = 0;
      const sellerSocket = await connectAs(seller.token);
      await post(buyer.token, "Are you there?");
      await pause(150);
      expect(ctx.pusher.sent).toHaveLength(1);

      await ask(sellerSocket, "conversation:join", { conversationId });
      await post(buyer.token, "I can see you");
      await pause(150);
      expect(ctx.pusher.sent).toHaveLength(1);

      await ask(sellerSocket, "conversation:leave", { conversationId });
      await post(buyer.token, "Now you left");
      await pause(150);
      expect(ctx.pusher.sent).toHaveLength(2);
    });
  });
});
