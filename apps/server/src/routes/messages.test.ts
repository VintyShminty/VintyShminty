import { blocks, conversations, messages } from "@vinty/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishTestListing,
  signUpTestUser,
  type TestContext,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("conversations and messages", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  const stamp = Date.now().toString(36);

  type Person = { token: string; id: string; username: string };
  let seller: Person;
  let buyer: Person;
  let buyer2: Person;
  let stranger: Person;
  let listingId: string;
  let secondListingId: string;
  let conversationId: string;

  const call = (
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    token?: string,
    payload?: object,
  ) => ctx.app.inject({ method, url, headers: token ? bearer(token) : {}, ...(payload ? { payload } : {}) });
  const send = (token: string, id: string, body: string, clientMessageId = crypto.randomUUID()) =>
    call("POST", `/v1/conversations/${id}/messages`, token, { kind: "text", body, clientMessageId });

  beforeAll(async () => {
    ctx = await buildTestApp();
    [seller, buyer, buyer2, stranger] = (await Promise.all(
      ["seller", "buyer", "buyer2", "stranger"].map((n) => signUpTestUser(ctx, `m${n}`, createdIds)),
    )) as Person[];
    listingId = await publishTestListing(ctx, seller, `Chat ${stamp} jacket`);
    secondListingId = await publishTestListing(ctx, seller, `Chat ${stamp} scarf`);
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("needs a session for everything", async () => {
    for (const [method, url] of [
      ["GET", "/v1/conversations"],
      ["POST", "/v1/conversations"],
      ["GET", `/v1/conversations/${crypto.randomUUID()}`],
      ["GET", "/v1/me/unread"],
    ] as const) {
      const payload = method === "POST" ? { listingId: crypto.randomUUID() } : undefined;
      expect((await call(method, url, undefined, payload)).statusCode).toBe(401);
    }
  });

  describe("starting a chat", () => {
    it("creates once and returns the same chat after that", async () => {
      const first = await call("POST", "/v1/conversations", buyer.token, { listingId });
      expect(first.statusCode, first.body).toBe(201);
      const created = first.json();
      conversationId = created.id;
      expect(created.role).toBe("buyer");
      expect(created.otherUser.id).toBe(seller.id);
      expect(created.listing.id).toBe(listingId);
      expect(created.listing.buyerPriceMinor).toBeGreaterThanOrEqual(created.listing.priceMinor);
      expect(created.order).toBeNull();
      expect(created.blocked).toBe(false);

      const again = await call("POST", "/v1/conversations", buyer.token, { listingId });
      expect(again.statusCode).toBe(200);
      expect(again.json().id).toBe(conversationId);
    });

    it("puts the chat on the item page for the buyer only", async () => {
      const mine = await call("GET", `/v1/listings/${listingId}`, buyer.token);
      expect(mine.json().viewer.conversationId).toBe(conversationId);
      const other = await call("GET", `/v1/listings/${listingId}`, stranger.token);
      expect(other.json().viewer.conversationId).toBeNull();
    });

    it("sends a first message when a body is given, and only once on a repeat", async () => {
      const clientMessageId = crypto.randomUUID();
      const res = await call("POST", "/v1/conversations", buyer2.token, {
        listingId,
        body: "Is it still available?",
        clientMessageId,
      });
      expect(res.statusCode).toBe(201);
      const id = res.json().id as string;
      await call("POST", "/v1/conversations", buyer2.token, {
        listingId,
        body: "Is it still available?",
        clientMessageId,
      });
      const rows = await ctx.database.db.select().from(messages).where(eq(messages.conversationId, id));
      expect(rows).toHaveLength(1);
    });

    it("refuses yourself, unknown and draft listings", async () => {
      const self = await call("POST", "/v1/conversations", seller.token, { listingId });
      expect(self.statusCode).toBe(403);
      expect(self.json().error.code).toBe("forbidden");
      const unknown = await call("POST", "/v1/conversations", buyer.token, {
        listingId: crypto.randomUUID(),
      });
      expect(unknown.statusCode).toBe(404);
    });

    it("refuses a block in either direction", async () => {
      const db = ctx.database.db;
      await db.insert(blocks).values({ blockerId: seller.id, blockedId: stranger.id });
      const blockedByThem = await call("POST", "/v1/conversations", stranger.token, { listingId });
      expect(blockedByThem.statusCode).toBe(403);
      expect(blockedByThem.json().error.code).toBe("blocked");
      await db.delete(blocks).where(eq(blocks.blockerId, seller.id));

      await db.insert(blocks).values({ blockerId: stranger.id, blockedId: seller.id });
      const blockedByMe = await call("POST", "/v1/conversations", stranger.token, { listingId });
      expect(blockedByMe.statusCode).toBe(403);
      expect(blockedByMe.json().error.code).toBe("blocked");
      await db.delete(blocks).where(eq(blocks.blockerId, stranger.id));
    });

    it("does not list a chat that has no message yet", async () => {
      const list = await call("GET", "/v1/conversations", buyer.token);
      expect(list.json().items.map((c: { id: string }) => c.id)).not.toContain(conversationId);
    });
  });

  describe("sending", () => {
    it("stores a text message and answers 201, then 200 for a retry with the same id", async () => {
      const clientMessageId = crypto.randomUUID();
      const first = await send(buyer.token, conversationId, "  Hello there  ", clientMessageId);
      expect(first.statusCode, first.body).toBe(201);
      expect(first.json().body).toBe("Hello there");
      expect(first.json().senderId).toBe(buyer.id);
      expect(first.json().clientMessageId).toBe(clientMessageId);

      const retry = await send(buyer.token, conversationId, "  Hello there  ", clientMessageId);
      expect(retry.statusCode).toBe(200);
      expect(retry.json().id).toBe(first.json().id);
      const rows = await ctx.database.db
        .select()
        .from(messages)
        .where(
          and(eq(messages.conversationId, conversationId), eq(messages.clientMessageId, clientMessageId)),
        );
      expect(rows).toHaveLength(1);
    });

    it("rejects empty, too long and malformed messages", async () => {
      expect((await send(buyer.token, conversationId, "   ")).statusCode).toBe(400);
      expect((await send(buyer.token, conversationId, "x".repeat(4001))).statusCode).toBe(400);
      const noId = await call("POST", `/v1/conversations/${conversationId}/messages`, buyer.token, {
        kind: "text",
        body: "hi",
      });
      expect(noId.statusCode).toBe(400);
      const offer = await call("POST", `/v1/conversations/${conversationId}/messages`, buyer.token, {
        kind: "offer",
        clientMessageId: crypto.randomUUID(),
      });
      expect(offer.statusCode).toBe(400);
    });

    it("sends a photo from the sender's own folder only", async () => {
      const ok = await call("POST", `/v1/conversations/${conversationId}/messages`, buyer.token, {
        kind: "photo",
        attachmentKey: `messages/${buyer.id}/${stamp}.jpg`,
        width: 600,
        height: 800,
        clientMessageId: crypto.randomUUID(),
      });
      expect(ok.statusCode, ok.body).toBe(201);
      expect(ok.json().attachment.url).toContain(`messages/${buyer.id}/`);
      expect(ok.json().attachment.width).toBe(600);

      const stolen = await call("POST", `/v1/conversations/${conversationId}/messages`, buyer.token, {
        kind: "photo",
        attachmentKey: `messages/${seller.id}/${stamp}.jpg`,
        clientMessageId: crypto.randomUUID(),
      });
      expect(stolen.statusCode).toBe(400);
      const wrongFolder = await call("POST", `/v1/conversations/${conversationId}/messages`, buyer.token, {
        kind: "photo",
        attachmentKey: `listings/${buyer.id}/${stamp}.jpg`,
        clientMessageId: crypto.randomUUID(),
      });
      expect(wrongFolder.statusCode).toBe(400);
    });

    it("keeps strangers out of every conversation route", async () => {
      const id = conversationId;
      const checks = [
        call("GET", `/v1/conversations/${id}`, stranger.token),
        call("GET", `/v1/conversations/${id}/messages`, stranger.token),
        send(stranger.token, id, "let me in"),
        call("POST", `/v1/conversations/${id}/read`, stranger.token),
        call("PUT", `/v1/conversations/${id}/archive`, stranger.token, { archived: true }),
        call("PUT", `/v1/conversations/${id}/mute`, stranger.token, { muted: true }),
      ];
      for (const res of await Promise.all(checks)) expect(res.statusCode).toBe(404);
    });

    it("lets the seller answer, and refuses both sides once a block exists but still shows the thread", async () => {
      expect((await send(seller.token, conversationId, "Yes it is")).statusCode).toBe(201);
      const db = ctx.database.db;
      await db.insert(blocks).values({ blockerId: seller.id, blockedId: buyer.id });
      const refused = await send(buyer.token, conversationId, "Hello?");
      expect(refused.statusCode).toBe(403);
      expect(refused.json().error.code).toBe("blocked");
      const refusedOther = await send(seller.token, conversationId, "Go away");
      expect(refusedOther.statusCode).toBe(403);
      const detail = await call("GET", `/v1/conversations/${conversationId}`, buyer.token);
      expect(detail.statusCode).toBe(200);
      expect(detail.json().blocked).toBe(true);
      expect(
        (await call("GET", `/v1/conversations/${conversationId}/messages`, buyer.token)).statusCode,
      ).toBe(200);
      await db.delete(blocks).where(eq(blocks.blockerId, seller.id));
    });
  });

  describe("reading the thread", () => {
    it("pages newest first without gaps or repeats", async () => {
      const created = await call("POST", "/v1/conversations", buyer.token, { listingId: secondListingId });
      const id = created.json().id as string;
      const sent: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await send(i % 2 === 0 ? buyer.token : seller.token, id, `message ${i}`);
        sent.push(res.json().id);
      }
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 5; page++) {
        const res = await call(
          "GET",
          `/v1/conversations/${id}/messages?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          buyer.token,
        );
        expect(res.statusCode).toBe(200);
        const body = res.json() as { items: { id: string }[]; nextCursor: string | null };
        seen.push(...body.items.map((m) => m.id));
        cursor = body.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toEqual([...sent].reverse());
    });

    it("starts again from the top when the cursor is garbage", async () => {
      const res = await call(
        "GET",
        `/v1/conversations/${conversationId}/messages?cursor=not-a-cursor`,
        buyer.token,
      );
      expect(res.statusCode).toBe(200);
      expect(res.json().items.length).toBeGreaterThan(0);
    });
  });

  describe("inbox, unread, archive and mute", () => {
    let id: string;
    beforeAll(async () => {
      id = (await call("POST", "/v1/conversations", buyer2.token, { listingId: secondListingId })).json().id;
      await send(buyer2.token, id, "Hi, what size is it?");
    });

    it("shows the chat to both people with the right unread flag", async () => {
      const sellerList = await call("GET", "/v1/conversations", seller.token);
      const row = sellerList.json().items.find((c: { id: string }) => c.id === id);
      expect(row.unread).toBe(true);
      expect(row.role).toBe("seller");
      expect(row.otherUser.id).toBe(buyer2.id);
      expect(row.lastMessagePreview).toBe("Hi, what size is it?");
      expect(row.lastMessageKind).toBe("text");
      expect(row.listing.title).toContain("scarf");

      const buyerList = await call("GET", "/v1/conversations", buyer2.token);
      const own = buyerList.json().items.find((c: { id: string }) => c.id === id);
      expect(own.unread).toBe(false);
    });

    it("counts unread chats and clears them when read", async () => {
      const before = (await call("GET", "/v1/me/unread", seller.token)).json();
      expect(before.messages).toBeGreaterThanOrEqual(1);
      expect((await call("POST", `/v1/conversations/${id}/read`, seller.token)).statusCode).toBe(204);
      const after = (await call("GET", "/v1/me/unread", seller.token)).json();
      expect(after.messages).toBe(before.messages - 1);
      const row = (await call("GET", "/v1/conversations", seller.token))
        .json()
        .items.find((c: { id: string }) => c.id === id);
      expect(row.unread).toBe(false);
      // The buyer's thread now knows when the seller last read it (the "Seen" line).
      const buyerDetail = (await call("GET", `/v1/conversations/${id}`, buyer2.token)).json();
      expect(Date.parse(buyerDetail.otherLastReadAt)).toBeGreaterThan(0);
      // Only the reader's marker moved: the buyer's own view is unaffected.
      await send(seller.token, id, "It is a one size scarf");
      const buyerRow = (await call("GET", "/v1/conversations", buyer2.token))
        .json()
        .items.find((c: { id: string }) => c.id === id);
      expect(buyerRow.unread).toBe(true);
    });

    it("archives for one side only, and a new message brings it back", async () => {
      expect(
        (await call("PUT", `/v1/conversations/${id}/archive`, seller.token, { archived: true })).statusCode,
      ).toBe(204);
      const inbox = (await call("GET", "/v1/conversations", seller.token)).json().items;
      expect(inbox.map((c: { id: string }) => c.id)).not.toContain(id);
      const archive = (await call("GET", "/v1/conversations?archived=true", seller.token)).json().items;
      const archived = archive.find((c: { id: string }) => c.id === id);
      expect(archived.archived).toBe(true);
      const buyerInbox = (await call("GET", "/v1/conversations", buyer2.token)).json().items;
      expect(buyerInbox.map((c: { id: string }) => c.id)).toContain(id);

      await send(buyer2.token, id, "Thanks!");
      const back = (await call("GET", "/v1/conversations", seller.token)).json().items;
      expect(back.map((c: { id: string }) => c.id)).toContain(id);

      expect(
        (await call("PUT", `/v1/conversations/${id}/archive`, seller.token, { archived: true })).statusCode,
      ).toBe(204);
      expect(
        (await call("PUT", `/v1/conversations/${id}/archive`, seller.token, { archived: false })).statusCode,
      ).toBe(204);
      const restored = (await call("GET", "/v1/conversations", seller.token)).json().items;
      expect(restored.map((c: { id: string }) => c.id)).toContain(id);
    });

    it("leaves muted chats out of the red dot but keeps them listed", async () => {
      await call("POST", `/v1/conversations/${id}/read`, seller.token);
      await send(buyer2.token, id, "One more thing");
      const withDot = (await call("GET", "/v1/me/unread", seller.token)).json().messages;
      expect(
        (await call("PUT", `/v1/conversations/${id}/mute`, seller.token, { muted: true })).statusCode,
      ).toBe(204);
      const muted = (await call("GET", "/v1/me/unread", seller.token)).json().messages;
      expect(muted).toBe(withDot - 1);
      const row = (await call("GET", "/v1/conversations", seller.token))
        .json()
        .items.find((c: { id: string }) => c.id === id);
      expect(row.muted).toBe(true);
      expect(row.unread).toBe(true);
      await call("PUT", `/v1/conversations/${id}/mute`, seller.token, { muted: false });
    });

    it("pages the inbox by cursor", async () => {
      const first = (await call("GET", "/v1/conversations?limit=1", seller.token)).json();
      expect(first.items).toHaveLength(1);
      expect(first.nextCursor).toBeTruthy();
      const second = (
        await call(
          "GET",
          `/v1/conversations?limit=1&cursor=${encodeURIComponent(first.nextCursor)}`,
          seller.token,
        )
      ).json();
      expect(second.items).toHaveLength(1);
      expect(second.items[0].id).not.toBe(first.items[0].id);
    });
  });

  it("limits a person to 20 messages a minute in one chat", async () => {
    const [a, b] = (await Promise.all([
      signUpTestUser(ctx, "ratea", createdIds),
      signUpTestUser(ctx, "rateb", createdIds),
    ])) as Person[];
    const listing = await publishTestListing(ctx, b, `Chat ${stamp} limit`);
    const chat = (await call("POST", "/v1/conversations", a.token, { listingId: listing })).json()
      .id as string;
    let last = await send(a.token, chat, "spam first");
    let ok = last.statusCode === 201 ? 1 : 0;
    for (let i = 1; i < 22; i++) {
      last = await send(a.token, chat, `spam ${i}`);
      if (last.statusCode === 201) ok++;
    }
    expect(ok).toBe(20);
    expect(last.statusCode).toBe(429);
    // The app waits this long before it tries again.
    const wait = Number(last.headers["retry-after"]);
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(60);
    await ctx.database.db.delete(conversations).where(eq(conversations.id, chat));
  });
});
