import { killSwitches } from "@vinty/db";
import type { HelpAnswer } from "@vinty/shared";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { fakeHelpReader } from "../lib/help-answer.js";
import { buildTestApp, databaseUrl, type TestContext } from "../test-helpers.js";

const GOOD = { answered: true, answer: "Tap Buy and pay.", articles: ["A1"] };

// Runs only when DATABASE_URL points at a migrated local database.
describe.skipIf(!databaseUrl)("help answers", () => {
  const contexts: TestContext[] = [];
  afterAll(async () => {
    await Promise.all(contexts.map((c) => c.close()));
  });

  async function setup(reader: ReturnType<typeof fakeHelpReader>) {
    const ctx = await buildTestApp({}, { helpReader: reader });
    contexts.push(ctx);
    const ask = (question: string, remoteAddress = "10.2.0.1", language = "en") =>
      ctx.app.inject({ method: "POST", url: "/v1/help/ask", remoteAddress, payload: { question, language } });
    return { ctx, ask };
  }

  it("works signed out and gives a cleaned answer", async () => {
    const reader = fakeHelpReader(GOOD);
    const t = await setup(reader);
    const res = await t.ask("How do I buy something?");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ answered: true, answer: "Tap Buy and pay.", articleIds: ["buyAnItem"] });
    expect(reader.calls).toHaveLength(1);
    expect(reader.calls[0]?.catalog).toContain("[buyAnItem]");
    expect(reader.calls[0]?.userId).toBeUndefined();
  });

  it("answers a repeated question from memory, per language", async () => {
    const reader = fakeHelpReader(GOOD);
    const t = await setup(reader);
    await t.ask("How do I   buy?");
    const again = await t.ask("how do i buy?");
    expect((again.json() as HelpAnswer).answered).toBe(true);
    expect(reader.calls).toHaveLength(1);
    await t.ask("how do i buy?", "10.2.0.1", "he");
    expect(reader.calls).toHaveLength(2);
  });

  it("remembers a not covered answer too", async () => {
    const reader = fakeHelpReader({ answered: false, answer: null, articles: [] });
    const t = await setup(reader);
    await t.ask("What is the weather?");
    const again = await t.ask("What is the weather?");
    expect((again.json() as HelpAnswer).answered).toBe(false);
    expect(reader.calls).toHaveLength(1);
  });

  it("gives the empty answer when the reader fails, and does not remember it", async () => {
    let fail = true;
    const reader = fakeHelpReader(() => {
      if (fail) throw new Error("model fell over");
      return GOOD;
    });
    const t = await setup(reader);
    const failed = await t.ask("How do I buy?");
    expect(failed.statusCode).toBe(200);
    expect(failed.json()).toEqual({ answered: false, answer: null, articleIds: [] });
    fail = false;
    const retry = await t.ask("How do I buy?");
    expect((retry.json() as HelpAnswer).answered).toBe(true);
    expect(reader.calls).toHaveLength(2);
  });

  it("gives empty, without a call, after 20 new questions an hour from one address", async () => {
    const reader = fakeHelpReader(GOOD);
    const t = await setup(reader);
    for (let i = 0; i < 20; i++)
      expect((await t.ask(`question number ${i}`, "10.2.0.9")).statusCode).toBe(200);
    expect(reader.calls).toHaveLength(20);
    const over = await t.ask("one more question", "10.2.0.9");
    expect(over.statusCode).toBe(200);
    expect((over.json() as HelpAnswer).answered).toBe(false);
    expect(reader.calls).toHaveLength(20);
    // Another address is still fine.
    expect(((await t.ask("one more question", "10.2.0.10")).json() as HelpAnswer).answered).toBe(true);
  });

  it("is off without a key", async () => {
    const reader = fakeHelpReader();
    const t = await setup(reader);
    const res = await t.ask("How do I buy?");
    expect(res.json()).toEqual({ answered: false, answer: null, articleIds: [] });
    expect(reader.calls).toHaveLength(0);
  });

  it("checks the request", async () => {
    const t = await setup(fakeHelpReader(GOOD));
    for (const question of ["", "hi", "x".repeat(301)]) {
      const res = await t.ask(question);
      expect(res.statusCode).toBe(400);
    }
  });

  it("reports the status, false when the AI switch is off", async () => {
    const t = await setup(fakeHelpReader(GOOD));
    const db = t.ctx.database.db;
    if (!db) throw new Error("no database");
    await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
    const on = await t.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
    expect(on.json().helpAssist).toBe(true);
    await db.insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused" });
    try {
      const fresh = await setup(fakeHelpReader(GOOD));
      const off = await fresh.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
      expect(off.json().helpAssist).toBe(false);
    } finally {
      await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
    }
  });
});
