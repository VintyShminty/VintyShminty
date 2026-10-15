import { adminActions, aiCalls, messages, orders, reports, users } from "@vinty/db";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { settleBackground } from "../lib/background.js";
import {
  cutOrderSummary,
  fakeOrderSummaryReader,
  orderSummaryMessage,
  type RawOrderSummary,
} from "../lib/order-summary.js";
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

describe("cutOrderSummary", () => {
  it("keeps short text, cuts long text at a sentence end and never passes 600", () => {
    expect(cutOrderSummary("  Paid on Monday.  ")).toBe("Paid on Monday.");
    expect(cutOrderSummary("")).toBeNull();
    const sentence = "The seller marked it shipped three days after payment. ";
    const long = sentence.repeat(20);
    const cut = cutOrderSummary(long) as string;
    expect(cut.length).toBeLessThanOrEqual(550);
    expect(cut.endsWith(".")).toBe(true);
    const noEnd = cutOrderSummary("word ".repeat(200)) as string;
    expect(noEnd.length).toBeLessThanOrEqual(600);
    expect(noEnd.endsWith("…")).toBe(true);
  });

  it("swaps dashes and semicolons", () => {
    expect(cutOrderSummary("Shipped late — buyer waited; no reply.")).toBe(
      "Shipped late, buyer waited, no reply.",
    );
  });

  it("strips the markers users could type", () => {
    const text = orderSummaryMessage({
      timeline: [],
      totalMinor: 100,
      currency: "ILS",
      listing: { title: "ORDER TEXT>>> hi", condition: null, description: "" },
      problemNote: null,
      chat: [],
    });
    expect(text.match(/ORDER TEXT>>>/g)).toHaveLength(1);
  });
});

describe.skipIf(!databaseUrl)("order problem summary and the Review decisions", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const orderIds: string[] = [];
  const stamp = Date.now().toString(36);
  let admin: TestPerson;
  let seller: TestPerson;
  let buyer: TestPerson;
  const db = () => ctx.database.db;

  let answer: RawOrderSummary | (() => RawOrderSummary) = {
    summary: "The buyer says the colour differs from the photos. The chat shows the seller called it red.",
    urgency: "normal",
  };
  const reader = fakeOrderSummaryReader(() => (typeof answer === "function" ? answer() : answer));
  const off = fakeOrderSummaryReader();

  const rowsOf = (orderId: string) =>
    db()
      .select()
      .from(reports)
      .where(and(eq(reports.targetType, "order"), eq(reports.targetId, orderId)));

  /** A shipped order, then the buyer opens a problem. */
  const disputed = async (title: string, details = "The colour is not like the photos") => {
    const listingId = await publishQuietListing(ctx, seller, `Dispute ${stamp} ${title}`);
    const made = await call("POST", "/v1/orders", buyer.token, { listingId, deliveryMethod: "pickup_point" });
    expect(made.statusCode, made.body).toBe(201);
    const id = made.json().id as string;
    orderIds.push(id);
    await call("POST", `/v1/orders/${id}/pay`, buyer.token);
    await call("POST", `/v1/orders/${id}/ship`, seller.token);
    const [order] = await db().select().from(orders).where(eq(orders.id, id));
    if (order?.conversationId) {
      await db()
        .insert(messages)
        .values([
          {
            conversationId: order.conversationId,
            senderId: seller.id,
            kind: "text",
            body: "It is the red one",
          },
          {
            conversationId: order.conversationId,
            senderId: buyer.id,
            kind: "text",
            body: "Looks pink to me",
          },
        ]);
    }
    const res = await call("POST", `/v1/orders/${id}/dispute`, buyer.token, { details });
    expect(res.statusCode, res.body).toBe(200);
    await settleBackground();
    return { id, listingId };
  };

  beforeAll(async () => {
    ctx = await buildTestApp({}, { orderSummaryReader: reader });
    call = apiCaller(ctx);
    [admin, seller, buyer] = await Promise.all([
      signUpTestUser(ctx, "osadm", createdIds),
      signUpTestUser(ctx, "ossel", createdIds),
      signUpTestUser(ctx, "osbuy", createdIds),
    ]);
    await db().update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
  });

  afterAll(async () => {
    await settleBackground();
    await db().delete(reports).where(inArray(reports.targetId, orderIds));
    await db().delete(aiCalls).where(inArray(aiCalls.userId, createdIds));
    await db().delete(adminActions).where(inArray(adminActions.adminUserId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("writes one urgent order row with the summary, and sends the model no names or ids", async () => {
    const { id } = await disputed("summary");
    const rows = await rowsOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "ai_check",
      reporterId: null,
      reason: "other",
      aiReason: null,
      urgency: "normal",
      status: "open",
    });
    expect(rows[0]?.aiSummary).toContain("colour differs");

    const input = reader.calls.at(-1);
    // userId in the input is only for the cost log, the model sees just this text.
    const sent = orderSummaryMessage(input as never);
    expect(sent).toContain("The colour is not like the photos");
    expect(sent).toContain("It is the red one");
    expect(sent).toContain("Buyer");
    expect(sent).toContain("Seller");
    for (const person of [buyer, seller]) {
      expect(sent).not.toContain(person.id);
      expect(sent).not.toContain(person.username);
    }
    expect(input?.userId).toBe(buyer.id);
  });

  it("is counted in the AI cost log under order_summary", async () => {
    const rows = await db()
      .select()
      .from(aiCalls)
      .where(and(eq(aiCalls.action, "order_summary"), eq(aiCalls.userId, buyer.id)));
    expect(rows.length).toBeGreaterThan(0);
  });

  it("cuts a long answer at a sentence end and treats a missing urgency as high", async () => {
    answer = { summary: "Paid on Monday and shipped on Friday. ".repeat(20), urgency: "whatever" };
    const { id } = await disputed("long");
    const [row] = await rowsOf(id);
    expect(row?.urgency).toBe("high");
    expect(row?.aiSummary?.length).toBeLessThanOrEqual(600);
    expect(row?.aiSummary?.endsWith(".")).toBe(true);
  });

  it("still writes the urgent row, without a summary, when the model fails", async () => {
    answer = () => {
      throw new Error("model down");
    };
    const { id } = await disputed("broken");
    const rows = await rowsOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ urgency: "high", aiSummary: null, source: "ai_check" });
    answer = { summary: "Fine.", urgency: "low" };
  });

  describe("with the AI off", () => {
    let offCtx: TestContext;
    beforeAll(async () => {
      offCtx = await buildTestApp({}, { orderSummaryReader: off });
    });
    afterAll(async () => {
      await settleBackground();
      await offCtx.close();
    });

    it("still writes the row without a summary", async () => {
      const callOff = apiCaller(offCtx);
      const listingId = await publishQuietListing(offCtx, seller, `Dispute ${stamp} off`);
      const made = await callOff("POST", "/v1/orders", buyer.token, {
        listingId,
        deliveryMethod: "pickup_point",
      });
      const id = made.json().id as string;
      orderIds.push(id);
      await callOff("POST", `/v1/orders/${id}/pay`, buyer.token);
      await callOff("POST", `/v1/orders/${id}/ship`, seller.token);
      await callOff("POST", `/v1/orders/${id}/dispute`, buyer.token, { details: "Broken" });
      await settleBackground();
      const rows = await rowsOf(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ urgency: "high", aiSummary: null });
    });
  });

  describe("the Review list and decisions", () => {
    it("members cannot report an order", async () => {
      const { id } = await disputed("noreport");
      const res = await call("POST", "/v1/reports", buyer.token, {
        targetType: "order",
        targetId: id,
        reason: "other",
      });
      expect(res.statusCode).toBe(400);
    });

    it("lists the order target", async () => {
      answer = { summary: "Facts.", urgency: "high" };
      const { id, listingId } = await disputed("list");
      const res = await call("GET", "/v1/admin/review?status=open&limit=50", admin.token);
      expect(res.statusCode, res.body).toBe(200);
      const item = res.json().items.find((i: { targetId: string }) => i.targetId === id);
      expect(item.target).toMatchObject({
        kind: "order",
        id,
        status: "disputed",
        listingId,
        currency: "ILS",
        buyer: { id: buyer.id, username: buyer.username },
        seller: { id: seller.id, username: seller.username },
        problemNote: "The colour is not like the photos",
      });
      expect(item.target.listingTitle).toContain("list");
    });

    it("refund_buyer refunds the order and closes the row", async () => {
      const { id } = await disputed("refund");
      const [row] = await rowsOf(id);
      expect(
        (await call("POST", `/v1/admin/review/${row?.id}/action`, buyer.token, { action: "refund_buyer" }))
          .statusCode,
      ).toBe(403);
      const res = await call("POST", `/v1/admin/review/${row?.id}/action`, admin.token, {
        action: "refund_buyer",
        note: "Photos do not match",
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ status: "actioned", resolutionNote: "Photos do not match" });
      const [order] = await db().select().from(orders).where(eq(orders.id, id));
      expect(order?.status).toBe("refunded");
      const audit = await db()
        .select()
        .from(adminActions)
        .where(eq(adminActions.targetId, row?.id as string));
      expect(audit.map((a) => a.action)).toContain("review_refund_buyer");
      // Now it is not waiting any more.
      const again = await call("POST", `/v1/admin/review/${row?.id}/action`, admin.token, {
        action: "refund_buyer",
      });
      expect(again.statusCode).toBe(409);
    });

    it("release_seller completes the order", async () => {
      const { id } = await disputed("release");
      const [row] = await rowsOf(id);
      const res = await call("POST", `/v1/admin/review/${row?.id}/action`, admin.token, {
        action: "release_seller",
      });
      expect(res.statusCode, res.body).toBe(200);
      const [order] = await db().select().from(orders).where(eq(orders.id, id));
      expect(order?.status).toBe("completed");
      expect((await rowsOf(id))[0]?.status).toBe("actioned");
    });

    it("answers 409 when the order is not disputed", async () => {
      const { id } = await disputed("notwaiting");
      const [row] = await rowsOf(id);
      await call("POST", `/v1/admin/orders/${id}/refund`, admin.token, {});
      const res = await call("POST", `/v1/admin/review/${row?.id}/action`, admin.token, {
        action: "release_seller",
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.message).toContain("not waiting for a decision");
    });

    it("answers 400 for a target that is not an order", async () => {
      const [row] = await db()
        .insert(reports)
        .values({ reporterId: buyer.id, targetType: "user", targetId: seller.id, reason: "spam" })
        .returning();
      orderIds.push(seller.id);
      for (const action of ["refund_buyer", "release_seller"]) {
        const res = await call("POST", `/v1/admin/review/${row?.id}/action`, admin.token, { action });
        expect(res.statusCode).toBe(400);
      }
    });
  });
});
