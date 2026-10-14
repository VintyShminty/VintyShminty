import { adminActions, aiCalls, createDb, killSwitches } from "@vinty/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { databaseUrl } from "../test-helpers.js";
import { AiMeter, AiRefusedError, costOf, MODEL_PRICES } from "./ai-cost.js";

describe("costOf", () => {
  it("prices Haiku 5.5 input and output per million tokens", () => {
    // $0.10 and $0.50 per million tokens: 1 token costs 0.1 and 0.5 micro dollars.
    expect(costOf("claude-haiku-5-5", { inputTokens: 1000, outputTokens: 500 })).toBe(350);
    expect(costOf("claude-haiku-5-5", { inputTokens: 100_000 })).toBe(10_000);
    expect(costOf("claude-haiku-5-5", { outputTokens: 100_000 })).toBe(50_000);
  });

  it("counts cache reads at a tenth and cache writes at 1.25 times the input price", () => {
    expect(costOf("claude-haiku-5-5", { cacheReadTokens: 10_000 })).toBe(100);
    expect(costOf("claude-haiku-5-5", { cacheWriteTokens: 4000 })).toBe(500);
    expect(
      costOf("claude-haiku-5-5", {
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 10_000,
        cacheWriteTokens: 4000,
      }),
    ).toBe(950);
  });

  it("uses the long prompt rate card above 100K tokens", () => {
    // 100001 tokens at $0.50 per million is 50000.5 micro dollars, rounded up.
    expect(costOf("claude-haiku-5-5", { inputTokens: 100_001 })).toBe(50_001);
    expect(costOf("claude-haiku-5-5", { inputTokens: 100_000 })).toBe(10_000);
  });

  it("rounds up so a call with tokens never costs zero", () => {
    expect(costOf("claude-haiku-5-5", { inputTokens: 1 })).toBe(1);
    expect(costOf("claude-haiku-5-5", {})).toBe(0);
  });

  it("prices an unknown model like the most expensive known one and warns", () => {
    const warn = vi.fn();
    const mostExpensive = Math.max(...Object.values(MODEL_PRICES).map((p) => p.output));
    const cost = costOf("some-future-model", { outputTokens: 1000 }, { warn, error: vi.fn() });
    expect(cost).toBe(1000 * mostExpensive);
    expect(cost).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("AiMeter.record", () => {
  it("never throws into the caller", async () => {
    const error = vi.fn();
    const broken = {
      insert() {
        throw new Error("database is down");
      },
    };
    const meter = new AiMeter(broken as never, { logger: { warn: vi.fn(), error } });
    await expect(
      meter.record({ provider: "anthropic", model: "claude-haiku-5-5", action: "x", usage: {}, ok: true }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe.skipIf(!databaseUrl)("AI budget guard", () => {
  const database = createDb(databaseUrl as string);
  const db = database.db;
  const TEST_ACTION = "vt_guard_test";
  const call = { model: "claude-haiku-5-5", maxOutputTokens: 300, estimatedInputTokens: 1000 };
  const BIG = 1_000_000_000_000;

  const reset = async () => {
    await db.delete(aiCalls).where(eq(aiCalls.action, TEST_ACTION));
    await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
    // Local test database only: the audit rows the guard wrote when it tripped.
    await db.delete(adminActions).where(eq(adminActions.action, "ai_auto_disabled"));
  };
  beforeAll(reset);
  afterEach(reset);
  afterAll(async () => {
    await reset();
    await database.close();
  });

  const addSpend = (micros: number) =>
    db.insert(aiCalls).values({
      provider: "anthropic",
      model: "claude-haiku-5-5",
      action: TEST_ACTION,
      costUsdMicros: micros,
    });
  const aiSwitch = async () =>
    (await db.select().from(killSwitches).where(eq(killSwitches.name, "ai")).limit(1))[0];
  const autoDisabledRows = () =>
    db.select().from(adminActions).where(eq(adminActions.action, "ai_auto_disabled"));

  it("lets a call through when nothing is wrong, and records it", async () => {
    const meter = new AiMeter(db, { hourlyCapMicros: BIG, dailyCapMicros: BIG });
    await expect(meter.assertAllowed(call)).resolves.toBeUndefined();
    await meter.record({
      provider: "anthropic",
      model: "claude-haiku-5-5",
      action: TEST_ACTION,
      usage: { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 5000 },
      ok: true,
    });
    const [row] = await db.select().from(aiCalls).where(eq(aiCalls.action, TEST_ACTION));
    expect(row).toMatchObject({ inputTokens: 1000, outputTokens: 100, cacheReadTokens: 5000, ok: true });
    expect(row?.costUsdMicros).toBe(100 + 50 + 50);
  });

  it("refuses when the switch is off", async () => {
    await db.insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused by hand" });
    const meter = new AiMeter(db, { hourlyCapMicros: BIG, dailyCapMicros: BIG });
    await expect(meter.assertAllowed(call)).rejects.toMatchObject({ code: "switch_off" });
  });

  it("remembers the switch for 30 seconds in one server copy until it is invalidated", async () => {
    const meter = new AiMeter(db, { hourlyCapMicros: BIG, dailyCapMicros: BIG });
    await meter.assertAllowed(call);
    await db.insert(killSwitches).values({ name: "ai", enabled: false });
    await expect(meter.assertAllowed(call)).resolves.toBeUndefined();
    meter.invalidate();
    await expect(meter.assertAllowed(call)).rejects.toBeInstanceOf(AiRefusedError);
  });

  it("flips the switch off and writes an audit row when the hourly cap would be passed", async () => {
    const probe = new AiMeter(db, { hourlyCapMicros: BIG, dailyCapMicros: BIG });
    const { hourMicros } = await probe.spend();
    // This call is estimated at 1000 * 0.1 + 300 * 0.5 = 250 micro dollars. Leave room for 100.
    const meter = new AiMeter(db, { hourlyCapMicros: hourMicros + 1000, dailyCapMicros: BIG });
    await addSpend(900);
    const before = (await autoDisabledRows()).length;
    await expect(meter.assertAllowed(call)).rejects.toMatchObject({ code: "hourly_cap" });
    expect(await aiSwitch()).toMatchObject({ enabled: false, changedBy: null });
    expect((await aiSwitch())?.reason).toMatch(/Hourly AI cap/);
    const rows = await autoDisabledRows();
    expect(rows.length).toBe(before + 1);
    // Later calls are stopped by the switch, and a second audit row is not written.
    await expect(meter.assertAllowed(call)).rejects.toMatchObject({ code: "switch_off" });
    expect((await autoDisabledRows()).length).toBe(before + 1);
  });

  it("flips the switch off when the daily cap would be passed", async () => {
    const probe = new AiMeter(db, { hourlyCapMicros: BIG, dailyCapMicros: BIG });
    const { dayMicros } = await probe.spend();
    const meter = new AiMeter(db, { hourlyCapMicros: BIG, dailyCapMicros: dayMicros + 1000 });
    await addSpend(900);
    await expect(meter.assertAllowed(call)).rejects.toMatchObject({ code: "daily_cap" });
    expect((await aiSwitch())?.enabled).toBe(false);
    expect((await aiSwitch())?.reason).toMatch(/Daily AI cap/);
  });

  it("does not count spend older than an hour towards the hourly cap", async () => {
    await db.insert(aiCalls).values({
      provider: "anthropic",
      model: "claude-haiku-5-5",
      action: TEST_ACTION,
      costUsdMicros: 5_000_000,
      createdAt: new Date(Date.now() - 2 * 3_600_000),
    });
    const probe = new AiMeter(db, { hourlyCapMicros: BIG, dailyCapMicros: BIG });
    const { hourMicros } = await probe.spend();
    const meter = new AiMeter(db, { hourlyCapMicros: hourMicros + 1000, dailyCapMicros: BIG });
    await expect(meter.assertAllowed(call)).resolves.toBeUndefined();
  });
});
