import { aiCalls, messages, reports } from "@vinty/db";
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
describe.skipIf(!databaseUrl)("chat helpers: warnings (D-041)", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const messageIds: string[] = [];
  const stamp = Date.now().toString(36);
  let seller: TestPerson;
  let buyer: TestPerson;
  let listingId: string;
  let conversationId: string;
  const db = () => ctx.database.db;

  let checkAnswer: RawChatCheck = { warning: null, review: false, summary: "" };
  let checkBroken = false;
  const checkReader = fakeChatCheckReader(() => {
    if (checkBroken) throw new Error("model down");
    return checkAnswer;
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

  beforeAll(async () => {
    ctx = await buildTestApp({}, { chatCheckReader: checkReader });
    call = apiCaller(ctx);
    [seller, buyer] = await Promise.all([
      signUpTestUser(ctx, "casel", createdIds),
      signUpTestUser(ctx, "cabuy", createdIds),
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
});
