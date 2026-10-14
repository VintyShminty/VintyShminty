import { aiCalls, blocks, killSwitches, messages, reports } from "@vinty/db";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { settleBackground } from "../lib/background.js";
import {
  chatCheckMessage,
  fakeChatCheckReader,
  type RawChatCheck,
  resolveChatCheck,
} from "../lib/chat-check.js";
import {
  cleanReplies,
  fakeQuickRepliesReader,
  type QuickRepliesInput,
  quickRepliesMessage,
  type RawQuickReplies,
} from "../lib/quick-replies.js";
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
describe.skipIf(!databaseUrl)("chat helpers: warnings and quick replies (D-039)", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const messageIds: string[] = [];
  const stamp = Date.now().toString(36);
  let seller: TestPerson;
  let buyer: TestPerson;
  let stranger: TestPerson;
  let listingId: string;
  let conversationId: string;
  const db = () => ctx.database.db;

  let checkAnswer: RawChatCheck = { warning: null, review: false, summary: "" };
  let checkBroken = false;
  const checkReader = fakeChatCheckReader(() => {
    if (checkBroken) throw new Error("model down");
    return checkAnswer;
  });
  let repliesAnswer: RawQuickReplies = { replies: ["Yes, it is", "What is your best price?", "Sorry, no"] };
  let repliesBroken = false;
  const repliesReader = fakeQuickRepliesReader(() => {
    if (repliesBroken) throw new Error("model down");
    return repliesAnswer;
  });

  const send = async (token: string, body: string, clientMessageId = crypto.randomUUID()) => {
    const res = await call("POST", `/v1/conversations/${conversationId}/messages`, token, {
      kind: "text",
      body,
      clientMessageId,
    });
    expect(res.statusCode, res.body).toBeLessThan(300);
    const id = (res.json() as { id: string }).id;
    messageIds.push(id);
    await settleBackground();
    return { id, clientMessageId };
  };
  const quick = (token: string, language = "en", id = conversationId) =>
    call("POST", `/v1/conversations/${id}/quick-replies`, token, { language });

  beforeAll(async () => {
    ctx = await buildTestApp({}, { chatCheckReader: checkReader, quickRepliesReader: repliesReader });
    call = apiCaller(ctx);
    [seller, buyer, stranger] = await Promise.all([
      signUpTestUser(ctx, "casel", createdIds),
      signUpTestUser(ctx, "cabuy", createdIds),
      signUpTestUser(ctx, "castr", createdIds),
    ]);
    listingId = await publishTestListing(ctx, seller, `Assist ${stamp} coat`);
    const res = await call("POST", "/v1/conversations", buyer.token, { listingId });
    conversationId = (res.json() as { id: string }).id;
  });

  afterAll(async () => {
    await settleBackground();
    await db().delete(reports).where(inArray(reports.targetId, messageIds));
    await db().delete(aiCalls).where(inArray(aiCalls.userId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("the chat check", () => {
    it("leaves ordinary talk alone", async () => {
      const before = checkReader.calls.length;
      const { id } = await send(buyer.token, "Hi, is it still available?");
      expect(checkReader.calls.length).toBe(before + 1);
      const [row] = await db().select().from(messages).where(eq(messages.id, id));
      expect(row?.warning).toBeNull();
    });

    it("warns the recipient, tells them live, and adds no Review row for a plain warning", async () => {
      checkAnswer = { warning: "off_platform_contact", review: false, summary: "" };
      const emitted: { event: string; payload: unknown; room: string }[] = [];
      const spy = vi.spyOn(ctx.app.realtime, "toUser").mockImplementation(
        (userId: string) =>
          ({
            emit: (event: string, payload: unknown) => emitted.push({ event, payload, room: userId }),
          }) as never,
      );
      let id: string;
      try {
        ({ id } = await send(buyer.token, "Write me on WhatsApp 050-1234567"));
      } finally {
        spy.mockRestore();
      }
      const [row] = await db().select().from(messages).where(eq(messages.id, id));
      expect(row?.warning).toBe("off_platform_contact");
      const updates = emitted.filter((e) => e.event === "message:updated");
      expect(updates).toHaveLength(1);
      expect(updates[0]?.room).toBe(seller.id);
      expect(updates[0]?.payload).toMatchObject({
        conversationId,
        messageId: id,
        message: { id, warning: "off_platform_contact" },
      });
      const list = await call("GET", `/v1/conversations/${conversationId}/messages`, seller.token);
      const found = (list.json().items as { id: string; warning: string | null }[]).find((m) => m.id === id);
      expect(found?.warning).toBe("off_platform_contact");
      const rows = await db().select().from(reports).where(eq(reports.targetId, id));
      expect(rows).toHaveLength(0);
    });

    it("adds one Review row only for a clear scam, about the message and not its text", async () => {
      checkAnswer = {
        warning: "suspicious_link",
        review: true,
        summary: "Sends a link asking the seller to confirm card details.",
      };
      const { id } = await send(buyer.token, "Confirm your card here http://pay.example");
      const rows = await db().select().from(reports).where(eq(reports.targetId, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        source: "ai_check",
        reporterId: null,
        targetType: "message",
        reason: "scam_off_platform",
        aiReason: "scam_off_platform",
        urgency: "high",
        aiSummary: "Sends a link asking the seller to confirm card details.",
      });
    });

    it("does not check a retry, a photo or an offer", async () => {
      checkAnswer = { warning: null, review: false, summary: "" };
      const first = await send(buyer.token, "I can pay when we meet");
      const calls = checkReader.calls.length;
      const retry = await call("POST", `/v1/conversations/${conversationId}/messages`, buyer.token, {
        kind: "text",
        body: "I can pay when we meet",
        clientMessageId: first.clientMessageId,
      });
      expect(retry.statusCode).toBe(200);
      const photo = await call("POST", `/v1/conversations/${conversationId}/messages`, buyer.token, {
        kind: "photo",
        attachmentKey: `messages/${buyer.id}/pic.jpg`,
        clientMessageId: crypto.randomUUID(),
      });
      expect(photo.statusCode, photo.body).toBe(201);
      messageIds.push((photo.json() as { id: string }).id);
      const offer = await call("POST", `/v1/conversations/${conversationId}/offers`, buyer.token, {
        amountMinor: 5000,
      });
      await settleBackground();
      expect(offer.statusCode, offer.body).toBeLessThan(300);
      expect(checkReader.calls.length).toBe(calls);
    });

    it("sends the model roles and words only, never names or ids", async () => {
      checkAnswer = { warning: null, review: false, summary: "" };
      await send(seller.token, "Yes it is, size M");
      await send(buyer.token, "Great, can you do 80?");
      const input = checkReader.calls.at(-1);
      expect(input?.latest).toEqual({ side: "buyer", text: "Great, can you do 80?" });
      expect(input?.previous.length).toBeLessThanOrEqual(4);
      expect(input?.previous.at(-1)).toEqual({ side: "seller", text: "Yes it is, size M" });
      const text = chatCheckMessage(input as NonNullable<typeof input>);
      for (const secret of [seller.id, buyer.id, seller.username, buyer.username, conversationId]) {
        expect(text).not.toContain(secret);
      }
      expect(text).toContain("<<<CHAT");
    });

    it("never fails the send when the model is down", async () => {
      checkBroken = true;
      try {
        const { id } = await send(buyer.token, "hello again");
        const [row] = await db().select().from(messages).where(eq(messages.id, id));
        expect(row?.warning).toBeNull();
      } finally {
        checkBroken = false;
      }
    });

    it("is quiet when the AI is off", async () => {
      const off = fakeChatCheckReader();
      const t = await buildTestApp({}, { chatCheckReader: off });
      try {
        const [s, b] = await Promise.all([
          signUpTestUser(t, "caoffs", createdIds),
          signUpTestUser(t, "caoffb", createdIds),
        ]);
        const lid = await publishTestListing(t, s, `Assist off ${stamp}`);
        const c = apiCaller(t);
        const conv = (await c("POST", "/v1/conversations", b.token, { listingId: lid })).json() as {
          id: string;
        };
        const res = await c("POST", `/v1/conversations/${conv.id}/messages`, b.token, {
          kind: "text",
          body: "send money to my bank",
          clientMessageId: crypto.randomUUID(),
        });
        expect(res.statusCode).toBe(201);
        await settleBackground();
        expect(off.calls).toHaveLength(0);
      } finally {
        await t.close();
      }
    });

    it("is counted in the AI cost log under chat_check", async () => {
      const rows = await db()
        .select()
        .from(aiCalls)
        .where(and(eq(aiCalls.action, "chat_check"), eq(aiCalls.userId, buyer.id)));
      expect(rows.length).toBeGreaterThan(0);
    });

    it("tidies the model's answer", () => {
      expect(resolveChatCheck({ warning: " PRESSURE ", review: true, summary: " a  b " })).toEqual({
        warning: "pressure",
        review: true,
        summary: "a b",
      });
      expect(resolveChatCheck({ warning: "banned", review: null, summary: null })).toEqual({
        warning: null,
        review: false,
        summary: "",
      });
    });
  });

  describe("quick replies", () => {
    // A fresh chat so the newest message is under the test's control.
    let chat: string;
    let chatSeller: TestPerson;
    let chatBuyer: TestPerson;
    const sendIn = async (token: string, body: string) => {
      const res = await call("POST", `/v1/conversations/${chat}/messages`, token, {
        kind: "text",
        body,
        clientMessageId: crypto.randomUUID(),
      });
      expect(res.statusCode, res.body).toBe(201);
      await settleBackground();
      return (res.json() as { id: string }).id;
    };

    beforeAll(async () => {
      [chatSeller, chatBuyer] = await Promise.all([
        signUpTestUser(ctx, "qrsel", createdIds),
        signUpTestUser(ctx, "qrbuy", createdIds),
      ]);
      const lid = await publishTestListing(ctx, chatSeller, `Quick ${stamp} dress`);
      chat = (
        (await call("POST", "/v1/conversations", chatBuyer.token, { listingId: lid })).json() as {
          id: string;
        }
      ).id;
    });

    it("answers empty with no AI call when there is no message, or the newest is mine", async () => {
      const before = repliesReader.calls.length;
      expect((await quick(chatSeller.token, "en", chat)).json()).toEqual({ forMessageId: null, replies: [] });
      const mine = await sendIn(chatBuyer.token, "Is this still available?");
      expect((await quick(chatBuyer.token, "en", chat)).json()).toEqual({ forMessageId: null, replies: [] });
      expect(repliesReader.calls.length).toBe(before);
      expect(mine).toBeTruthy();
    });

    it("answers empty with no AI call when the newest message is not text", async () => {
      const before = repliesReader.calls.length;
      const photo = await call("POST", `/v1/conversations/${chat}/messages`, chatBuyer.token, {
        kind: "photo",
        attachmentKey: `messages/${chatBuyer.id}/q.jpg`,
        clientMessageId: crypto.randomUUID(),
      });
      expect(photo.statusCode, photo.body).toBe(201);
      expect((await quick(chatSeller.token, "en", chat)).json()).toEqual({ forMessageId: null, replies: [] });
      expect(repliesReader.calls.length).toBe(before);
    });

    it("returns cleaned replies for a text from the other person, and caches them", async () => {
      repliesAnswer = {
        replies: ["  Yes,   it is  ", "yes, it is", "", "x".repeat(120), "Sorry, no", "Fourth one"],
      };
      const newest = await sendIn(chatBuyer.token, "How much for the dress to ship to Haifa?");
      const before = repliesReader.calls.length;
      const first = await quick(chatSeller.token, "en", chat);
      expect(first.statusCode).toBe(200);
      const body = first.json() as { forMessageId: string; replies: string[] };
      expect(body.forMessageId).toBe(newest);
      expect(body.replies).toEqual(["Yes, it is", "x".repeat(80), "Sorry, no"]);
      expect(repliesReader.calls.length).toBe(before + 1);

      const input = repliesReader.calls.at(-1) as QuickRepliesInput;
      expect(input.askerSide).toBe("seller");
      expect(input.language).toBe("en");
      expect(input.messages.at(-1)).toEqual({
        side: "buyer",
        text: "How much for the dress to ship to Haifa?",
      });
      const text = quickRepliesMessage(input);
      for (const secret of [chatSeller.id, chatBuyer.id, chatSeller.username, chatBuyer.username, chat]) {
        expect(text).not.toContain(secret);
      }

      const again = await quick(chatSeller.token, "en", chat);
      expect(again.json()).toEqual(body);
      expect(repliesReader.calls.length).toBe(before + 1);
      // Another language is another answer.
      await quick(chatSeller.token, "he", chat);
      expect(repliesReader.calls.length).toBe(before + 2);
    });

    it("is counted in the AI cost log under quick_replies", async () => {
      const rows = await db()
        .select()
        .from(aiCalls)
        .where(and(eq(aiCalls.action, "quick_replies"), eq(aiCalls.userId, chatSeller.id)));
      expect(rows.length).toBeGreaterThan(0);
    });

    it("answers empty, not an error, when the model fails", async () => {
      await sendIn(chatBuyer.token, "Hello?");
      repliesBroken = true;
      try {
        const res = await quick(chatSeller.token, "en", chat);
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ forMessageId: null, replies: [] });
      } finally {
        repliesBroken = false;
      }
    });

    it("keeps people outside the chat out, and needs a session", async () => {
      expect((await quick(stranger.token, "en", chat)).statusCode).toBe(404);
      expect(
        (await call("POST", `/v1/conversations/${chat}/quick-replies`, undefined, { language: "en" }))
          .statusCode,
      ).toBe(401);
      expect((await quick(chatSeller.token, "fr", chat)).statusCode).toBe(400);
    });

    it("answers empty when a block exists between the two", async () => {
      await sendIn(chatBuyer.token, "Are you there?");
      await db().insert(blocks).values({ blockerId: chatSeller.id, blockedId: chatBuyer.id });
      try {
        const before = repliesReader.calls.length;
        expect((await quick(chatSeller.token, "en", chat)).json()).toEqual({
          forMessageId: null,
          replies: [],
        });
        expect(repliesReader.calls.length).toBe(before);
      } finally {
        await db().delete(blocks).where(eq(blocks.blockerId, chatSeller.id));
      }
    });

    it("cleans replies the way the app expects", () => {
      expect(cleanReplies({ replies: null })).toEqual([]);
      expect(cleanReplies({ replies: ["a", "A", " b ", "c", "d"] })).toEqual(["a", "b", "c"]);
    });
  });

  describe("status", () => {
    it("includes chatAssist, and says false when the AI switch is off", async () => {
      await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
      const on = await call("GET", "/v1/sell/assist");
      expect(on.json().chatAssist).toBe(true);
      await db().insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused" });
      try {
        // The meter remembers the switch for 30 seconds, so ask a fresh app copy.
        const fresh = await buildTestApp({}, { quickRepliesReader: fakeQuickRepliesReader({ replies: [] }) });
        try {
          const off = await apiCaller(fresh)("GET", "/v1/sell/assist");
          expect(off.json().chatAssist).toBe(false);
        } finally {
          await fresh.close();
        }
      } finally {
        await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
      }
    });

    it("says false when no reader has a key", async () => {
      const t = await buildTestApp({}, { quickRepliesReader: fakeQuickRepliesReader() });
      try {
        expect((await apiCaller(t)("GET", "/v1/sell/assist")).json().chatAssist).toBe(false);
      } finally {
        await t.close();
      }
    });
  });
});
