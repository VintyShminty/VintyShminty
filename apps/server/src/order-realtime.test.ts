import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishTestListing,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "./test-helpers.js";

type Seen = { event: string; payload: Record<string, unknown> };

describe.skipIf(!databaseUrl)("offer and order events over the socket", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  let url: string;
  const createdIds: string[] = [];
  const open: Socket[] = [];
  let seller: TestPerson;
  let buyer: TestPerson;
  let stranger: TestPerson;
  const stamp = Date.now().toString(36);

  /** A socket that writes down every event it receives. */
  const listen = (token: string) =>
    new Promise<{ socket: Socket; seen: Seen[] }>((resolve, reject) => {
      const seen: Seen[] = [];
      const socket = connect(url, { transports: ["websocket"], auth: { token }, reconnection: false });
      open.push(socket);
      socket.onAny((event, payload) => seen.push({ event, payload }));
      socket.on("connect", () => resolve({ socket, seen }));
      socket.on("connect_error", reject);
    });
  const pause = (ms = 300) => new Promise((r) => setTimeout(r, ms));
  const named = (seen: Seen[], event: string) => seen.filter((s) => s.event === event).map((s) => s.payload);

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    await ctx.app.listen({ port: 0, host: "127.0.0.1" });
    url = `http://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;
    [seller, buyer, stranger] = (await Promise.all(
      ["evseller", "evbuyer", "evstranger"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as TestPerson[];
  });

  afterEach(() => {
    for (const s of open.splice(0)) s.close();
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("tells both people about an offer and its answer, and nobody else", async () => {
    const listingId = await publishTestListing(ctx, seller, `Events ${stamp} offer`);
    const chat = (await call("POST", "/v1/conversations", buyer.token, { listingId })).json();
    const s = await listen(seller.token);
    const b = await listen(buyer.token);
    const x = await listen(stranger.token);
    await pause(100);

    const offer = (await call("POST", `/v1/conversations/${chat.id}/offers`, buyer.token, { amountMinor: 6000 })).json();
    await pause();
    for (const side of [s, b]) {
      const bubbles = named(side.seen, "message:new").filter((p) => (p.message as { kind: string }).kind === "offer");
      expect(bubbles).toHaveLength(1);
      expect((bubbles[0]?.message as { offer: { id: string; status: string } }).offer).toMatchObject({ id: offer.id, status: "pending" });
    }
    expect(named(s.seen, "notification:new").map((p) => (p.notification as { type: string }).type)).toContain("new_offer");

    await call("POST", `/v1/offers/${offer.id}/accept`, seller.token);
    await pause();
    for (const side of [s, b]) {
      const updated = named(side.seen, "message:updated");
      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({ conversationId: chat.id, offer: { id: offer.id, status: "accepted" } });
      const dividers = named(side.seen, "message:new").filter((p) => (p.message as { kind: string }).kind === "system");
      expect(dividers.map((p) => (p.message as { systemEvent: string }).systemEvent)).toEqual(["offer_accepted"]);
      expect(named(side.seen, "listing:updated")).toEqual([{ listingId, status: "reserved", priceMinor: 9000 }]);
    }
    expect(named(b.seen, "notification:new").map((p) => (p.notification as { type: string }).type)).toContain("offer_accepted");
    expect(x.seen.filter((e) => e.event !== "unread:count")).toEqual([]);
  });

  it("tells both people about every step of an order, and nobody else", async () => {
    const listingId = await publishTestListing(ctx, seller, `Events ${stamp} order`);
    const s = await listen(seller.token);
    const b = await listen(buyer.token);
    const x = await listen(stranger.token);
    await pause(100);

    const order = (await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" })).json();
    await pause();
    // The seller hears nothing about a checkout that is not paid.
    expect(named(s.seen, "order:updated")).toEqual([]);
    expect(named(b.seen, "order:updated")).toEqual([{ orderId: order.id, status: "pending_payment", conversationId: order.conversationId }]);

    await call("POST", `/v1/orders/${order.id}/pay`, buyer.token);
    await call("POST", `/v1/orders/${order.id}/ship`, seller.token);
    await call("POST", `/v1/orders/${order.id}/confirm-received`, buyer.token);
    await pause(500);

    const statuses = (seen: Seen[]) => named(seen, "order:updated").map((p) => p.status);
    expect(statuses(b.seen)).toEqual(["pending_payment", "paid", "shipped", "completed"]);
    expect(statuses(s.seen)).toEqual(["paid", "shipped", "completed"]);
    for (const side of [s, b]) {
      const dividers = named(side.seen, "message:new")
        .map((p) => p.message as { kind: string; systemEvent: string })
        .filter((m) => m.kind === "system")
        .map((m) => m.systemEvent);
      expect(dividers).toEqual(expect.arrayContaining(["order_paid", "order_shipped", "order_completed", "review_auto_left"]));
      const sold = named(side.seen, "listing:updated").map((p) => p.status);
      expect(sold).toContain("sold");
    }
    const sellerNotes = named(s.seen, "notification:new").map((p) => (p.notification as { type: string }).type);
    expect(sellerNotes).toEqual(expect.arrayContaining(["order_paid", "order_completed", "balance_released"]));
    expect(named(b.seen, "notification:new").map((p) => (p.notification as { type: string }).type)).toEqual(
      expect.arrayContaining(["order_shipped", "order_completed"]),
    );
    expect(x.seen.filter((e) => e.event !== "unread:count")).toEqual([]);
  });

  it("lets people who hearted an item hear it was sold", async () => {
    const listingId = await publishTestListing(ctx, seller, `Events ${stamp} heart`);
    await call("PUT", `/v1/listings/${listingId}/favourite`, stranger.token);
    const x = await listen(stranger.token);
    await pause(100);
    const order = (await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" })).json();
    await call("POST", `/v1/orders/${order.id}/pay`, buyer.token);
    await pause(400);
    expect(named(x.seen, "listing:updated").map((p) => p.status)).toEqual(["reserved", "sold"]);
    expect(named(x.seen, "notification:new").map((p) => (p.notification as { type: string }).type)).toEqual(["favourite_sold"]);
    // Still no order events for someone who is not in the order.
    expect(named(x.seen, "order:updated")).toEqual([]);
  });
});
