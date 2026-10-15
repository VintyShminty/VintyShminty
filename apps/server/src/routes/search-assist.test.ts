import { killSwitches } from "@vinty/db";
import type { SearchUnderstanding } from "@vinty/shared";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { fakeSearchReader } from "../lib/search-reader.js";
import { buildTestApp, databaseUrl, type TestContext } from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("search in plain words", () => {
  const contexts: TestContext[] = [];
  afterAll(async () => {
    await Promise.all(contexts.map((c) => c.close()));
  });

  async function setup(reader: ReturnType<typeof fakeSearchReader>) {
    const ctx = await buildTestApp({}, { searchReader: reader });
    contexts.push(ctx);
    const understand = (text: string, remoteAddress = "10.1.0.1") =>
      ctx.app.inject({
        method: "POST",
        url: "/v1/search/understand",
        remoteAddress,
        payload: { text, language: "en" },
      });
    return { ctx, understand };
  }

  it("works signed out and turns the answer into filters", async () => {
    const reader = fakeSearchReader({ colours: ["K1"], priceMax: 100, keywords: ["speedy"] });
    const t = await setup(reader);
    const res = await t.understand("red speedy bag under 100");
    expect(res.statusCode).toBe(200);
    const body = res.json() as SearchUnderstanding;
    expect(body.understood).toBe(true);
    expect(body.colourIds).toHaveLength(1);
    expect(body.priceMaxMinor).toBe(10000);
    expect(body.q).toBe("speedy");
    expect(reader.calls).toHaveLength(1);
    // The reader got the shopper's words and our lists, with groups and both languages.
    expect(reader.calls[0]?.catalog).toContain("CATEGORIES");
    expect(reader.calls[0]?.userId).toBeUndefined();
  });

  it("answers simple searches by fixed rules, without the reader and without using the hourly limit", async () => {
    const reader = fakeSearchReader({ colours: ["K1"] });
    const t = await setup(reader);
    // More answers than the hourly AI limit (20), all by rules, from one address.
    for (let i = 0; i < 24; i++) {
      const res = await t.understand(`red women under ${i + 1}`, "10.1.0.9");
      const body = res.json() as SearchUnderstanding;
      expect(body.understood).toBe(true);
      expect(body.colourIds).toHaveLength(1);
      expect(body.categoryId).not.toBeNull();
      expect(body.priceMaxMinor).toBe((i + 1) * 100);
      expect(body.q).toBe("");
    }
    const hebrew = (await t.understand("אדום לגברים עד 80 שקל")).json() as SearchUnderstanding;
    expect(hebrew.understood).toBe(true);
    expect(hebrew.priceMaxMinor).toBe(8000);
    expect(reader.calls).toHaveLength(0);
    // The 24 rules answers used none of the 20 an hour: an AI phrase from the same address still goes through.
    const res = await t.understand("red speedy dress under 100", "10.1.0.9");
    expect((res.json() as SearchUnderstanding).understood).toBe(true);
    expect(reader.calls).toHaveLength(1);
  });

  it("sends the AI the short list: no sizes unless the words mention one", async () => {
    const reader = fakeSearchReader({ colours: ["K1"] });
    const t = await setup(reader);
    await t.understand("red speedy bag under 100");
    await t.understand("red speedy bag size 38");
    expect(reader.calls).toHaveLength(2);
    expect(reader.calls[0]?.catalog).not.toContain("SIZE GROUPS");
    expect(reader.calls[1]?.catalog).toContain("SIZE GROUPS");
    expect(reader.calls[0]?.catalog).toContain("CATEGORIES");
  });

  it("answers empty, without calling the reader, for short searches", async () => {
    const reader = fakeSearchReader({ colours: ["K1"] });
    const t = await setup(reader);
    const res = await t.understand("zara dress");
    expect(res.statusCode).toBe(200);
    expect((res.json() as SearchUnderstanding).understood).toBe(false);
    expect(reader.calls).toHaveLength(0);
  });

  it("answers a repeated phrase from memory", async () => {
    const reader = fakeSearchReader({ colours: ["K1"] });
    const t = await setup(reader);
    const first = await t.understand("Red   speedy dress under 100");
    const again = await t.understand("red speedy dress UNDER 100");
    expect(again.json()).toEqual(first.json());
    expect(reader.calls).toHaveLength(1);
  });

  it("gives empty when the reader fails, and does not remember the failure", async () => {
    let fail = true;
    const reader = fakeSearchReader(() => {
      if (fail) throw new Error("model fell over");
      return { colours: ["K1"] };
    });
    const t = await setup(reader);
    const failed = await t.understand("red speedy dress under 100");
    expect(failed.statusCode).toBe(200);
    expect((failed.json() as SearchUnderstanding).understood).toBe(false);
    fail = false;
    const retry = await t.understand("red speedy dress under 100");
    expect((retry.json() as SearchUnderstanding).understood).toBe(true);
    expect(reader.calls).toHaveLength(2);
  });

  it("is off without a key", async () => {
    const reader = fakeSearchReader();
    const t = await setup(reader);
    const res = await t.understand("red speedy dress under 100");
    expect((res.json() as SearchUnderstanding).understood).toBe(false);
    expect(reader.calls).toHaveLength(0);
    const status = await t.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
    expect(status.json().searchAssist).toBe(false);
  });

  it("allows 20 new phrases an hour per address, then answers empty", async () => {
    const reader = fakeSearchReader({ colours: ["K1"] });
    const t = await setup(reader);
    for (let i = 0; i < 20; i++) {
      const res = await t.understand(`red speedy dress under ${i + 1}`, "10.1.0.2");
      expect((res.json() as SearchUnderstanding).understood).toBe(true);
    }
    const over = await t.understand("red speedy dress under 500", "10.1.0.2");
    expect(over.statusCode).toBe(200);
    expect((over.json() as SearchUnderstanding).understood).toBe(false);
    expect(reader.calls).toHaveLength(20);
    // A phrase already remembered still answers.
    const known = await t.understand("red speedy dress under 1", "10.1.0.2");
    expect((known.json() as SearchUnderstanding).understood).toBe(true);
  });

  it("checks the request", async () => {
    const t = await setup(fakeSearchReader({}));
    const res = await t.ctx.app.inject({
      method: "POST",
      url: "/v1/search/understand",
      payload: { text: "", language: "en" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("reports the status, false when the AI switch is off", async () => {
    const t = await setup(fakeSearchReader({}));
    const db = t.ctx.database.db;
    if (!db) throw new Error("no database");
    await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
    const on = await t.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
    expect(on.json().searchAssist).toBe(true);
    await db.insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused" });
    try {
      const fresh = await setup(fakeSearchReader({}));
      const off = await fresh.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
      expect(off.json().searchAssist).toBe(false);
    } finally {
      await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
    }
  });
});
