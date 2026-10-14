import {
  adminActions,
  aiCalls,
  expenseConfig,
  expenseMonths,
  killSwitches,
  standInSellers,
  users,
} from "@vinty/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

const TEST_ACTION = "vt_admin_test";

describe.skipIf(!databaseUrl)("admin panel", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  let admin: TestPerson;
  let other: TestPerson;
  let regular: TestPerson;
  const db = () => ctx.database.db;
  const thisMonth = new Date().toISOString().slice(0, 7);

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    [admin, other, regular] = await Promise.all([
      signUpTestUser(ctx, "adm", createdIds),
      signUpTestUser(ctx, "adm2", createdIds),
      signUpTestUser(ctx, "plain", createdIds),
    ]);
    await db()
      .update(users)
      .set({ role: "admin" })
      .where(inArray(users.id, [admin.id, other.id]));
    // Start from a known state for the shared admin tables.
    await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
    await db().delete(expenseMonths);
    await db().delete(expenseConfig);
  });
  afterAll(async () => {
    await db().delete(aiCalls).where(eq(aiCalls.action, TEST_ACTION));
    await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
    await db().delete(expenseMonths);
    await db().delete(expenseConfig);
    await db().delete(adminActions).where(inArray(adminActions.adminUserId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  const routes: [method: "GET" | "PUT" | "POST" | "DELETE", url: string, body?: object][] = [
    ["GET", "/v1/admin/dashboard"],
    ["GET", "/v1/admin/users"],
    ["POST", "/v1/admin/users/11111111-1111-4111-8111-111111111111/role", { role: "admin" }],
    ["DELETE", "/v1/admin/users/11111111-1111-4111-8111-111111111111"],
    ["GET", "/v1/admin/analytics"],
    ["GET", "/v1/admin/expenses"],
    ["PUT", "/v1/admin/expenses/config", { fixedCosts: [], usdToIlsRate: 3.6 }],
    ["PUT", `/v1/admin/expenses/months/${thisMonth}`, { fixedCosts: [] }],
    ["DELETE", `/v1/admin/expenses/months/${thisMonth}`],
    ["GET", "/v1/admin/security"],
    ["PUT", "/v1/admin/switches/ai", { enabled: true }],
  ];

  it.each(routes)(
    "%s %s is closed to signed out people (401) and to non admins (403)",
    async (method, url, body) => {
      expect((await call(method, url, undefined, body)).statusCode).toBe(401);
      expect((await call(method, url, regular.token, body)).statusCode).toBe(403);
    },
  );

  it("shows the dashboard numbers and the latest admin actions", async () => {
    await db()
      .insert(aiCalls)
      .values({ provider: "anthropic", model: "claude-haiku-5-5", action: TEST_ACTION, costUsdMicros: 1234 });
    const res = await call("GET", "/v1/admin/dashboard", admin.token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.stats.totalUsers).toBeGreaterThanOrEqual(3);
    expect(body.stats.newUsersLast7Days).toBeGreaterThanOrEqual(3);
    expect(body.stats.aiSpendThisMonthUsdMicros).toBeGreaterThanOrEqual(1234);
    expect(body.stats.aiCallsToday).toBeGreaterThanOrEqual(1);
    expect(body.recentActions.length).toBeLessThanOrEqual(20);
  });

  it("lists people with filters, search and a cursor", async () => {
    const all = await call("GET", `/v1/admin/users?q=${encodeURIComponent(admin.username)}`, admin.token);
    expect(all.statusCode).toBe(200);
    expect(all.json().items).toHaveLength(1);
    expect(all.json().items[0]).toMatchObject({
      id: admin.id,
      role: "admin",
      banned: false,
      isStandIn: false,
      listingCount: 0,
    });
    expect(all.json().items[0].lastSignInAt).not.toBeNull();

    const admins = (await call("GET", "/v1/admin/users?filter=admins&limit=50", admin.token)).json().items;
    expect(admins.every((u: { role: string }) => u.role === "admin")).toBe(true);
    expect(admins.map((u: { id: string }) => u.id)).toContain(admin.id);

    const page1 = (await call("GET", "/v1/admin/users?limit=1", admin.token)).json();
    expect(page1.items).toHaveLength(1);
    expect(page1.nextCursor).toEqual(expect.any(String));
    const page2 = (
      await call("GET", `/v1/admin/users?limit=1&cursor=${page1.nextCursor}`, admin.token)
    ).json();
    expect(page2.items[0].id).not.toBe(page1.items[0].id);

    await db()
      .insert(standInSellers)
      .values({ userId: regular.id, createdBy: admin.id })
      .onConflictDoNothing();
    const stand = (
      await call("GET", `/v1/admin/users?q=${encodeURIComponent(regular.username)}`, admin.token)
    ).json();
    expect(stand.items[0].isStandIn).toBe(true);
    // A search for a wildcard matches nothing special.
    expect((await call("GET", "/v1/admin/users?q=%25", admin.token)).json().items).toHaveLength(0);
  });

  it("changes a role, writes the audit row and refuses to demote yourself", async () => {
    const res = await call("POST", `/v1/admin/users/${regular.id}/role`, admin.token, { role: "admin" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: regular.id, role: "admin" });
    const [saved] = await db().select({ role: users.role }).from(users).where(eq(users.id, regular.id));
    expect(saved?.role).toBe("admin");
    const audit = (await db().select().from(adminActions).where(eq(adminActions.adminUserId, admin.id))).find(
      (a) => a.action === "user_role_changed" && a.targetId === regular.id,
    );
    expect(audit?.details).toEqual({ from: "user", to: "admin", username: expect.any(String) });

    expect(
      (await call("POST", `/v1/admin/users/${regular.id}/role`, admin.token, { role: "user" })).statusCode,
    ).toBe(200);
    const self = await call("POST", `/v1/admin/users/${admin.id}/role`, admin.token, { role: "user" });
    expect(self.statusCode).toBe(409);
    const [still] = await db().select({ role: users.role }).from(users).where(eq(users.id, admin.id));
    expect(still?.role).toBe("admin");
    expect(
      (
        await call("POST", "/v1/admin/users/11111111-1111-4111-8111-111111111111/role", admin.token, {
          role: "user",
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await call("POST", `/v1/admin/users/${regular.id}/role`, admin.token, { role: "banana" })).statusCode,
    ).toBe(400);
  });

  it("deletes another person but never yourself", async () => {
    expect((await call("DELETE", `/v1/admin/users/${admin.id}`, admin.token)).statusCode).toBe(409);
    const doomed = await signUpTestUser(ctx, "doomed", createdIds);
    const res = await call("DELETE", `/v1/admin/users/${doomed.id}`, admin.token);
    expect(res.statusCode).toBe(204);
    expect(await db().select().from(users).where(eq(users.id, doomed.id))).toHaveLength(0);
    const audit = (await db().select().from(adminActions).where(eq(adminActions.adminUserId, admin.id))).find(
      (a) => a.action === "user_deleted" && a.targetId === doomed.id,
    );
    expect(audit).toBeDefined();
    expect((await call("DELETE", `/v1/admin/users/${doomed.id}`, admin.token)).statusCode).toBe(404);
  });

  it("gives 8 weeks of counts and this month's AI use by action", async () => {
    const res = await call("GET", "/v1/admin/analytics", admin.token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.weeks).toHaveLength(8);
    expect(body.weeks[7].signups).toBeGreaterThanOrEqual(3);
    expect(body.weeks[0].weekStart < body.weeks[7].weekStart).toBe(true);
    expect(body.aiThisMonth.find((r: { action: string }) => r.action === TEST_ACTION)).toMatchObject({
      costUsdMicros: 1234,
    });
  });

  describe("expenses", () => {
    it("starts empty with the default dollar rate and refuses future months", async () => {
      const res = await call("GET", "/v1/admin/expenses", admin.token);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({ month: thisMonth, usesOverride: false, fixed: [], usdToIlsRate: 3.6 });
      expect(body.byAction.find((r: { action: string }) => r.action === TEST_ACTION)).toMatchObject({
        calls: 1,
        costUsdMicros: 1234,
        averageCostUsdMicros: 1234,
      });
      expect(body.auto.find((r: { provider: string }) => r.provider === "anthropic")).toBeDefined();
      expect(body.byModel.length).toBeGreaterThan(0);
      expect((await call("GET", "/v1/admin/expenses?month=2999-01", admin.token)).statusCode).toBe(400);
      expect((await call("GET", "/v1/admin/expenses?month=nope", admin.token)).statusCode).toBe(400);
    });

    it("saves the defaults and the rate, and totals in shekels", async () => {
      const res = await call("PUT", "/v1/admin/expenses/config", admin.token, {
        fixedCosts: [
          { name: "Hosting", amountMinor: 10000, currency: "ILS", kind: "subscription" },
          { name: "Domain", amountMinor: 1000, currency: "USD", kind: "configured" },
        ],
        usdToIlsRate: 4,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.usdToIlsRate).toBe(4);
      expect(body.fixed).toHaveLength(2);
      expect(body.usesOverride).toBe(false);
      // 100 shekels + 10 dollars at 4 = 140 shekels, in agorot, plus the AI spend (always a few agorot at most here).
      expect(body.totalIlsMinor).toBeGreaterThanOrEqual(14000);
    });

    it("saves one month on its own and goes back to the defaults when cleared", async () => {
      const own = [{ name: "Only this month", amountMinor: 500, currency: "ILS", kind: "configured" }];
      const saved = await call("PUT", `/v1/admin/expenses/months/${thisMonth}`, admin.token, {
        fixedCosts: own,
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({ usesOverride: true, fixed: own });
      expect(
        (await call("GET", `/v1/admin/expenses?month=${thisMonth}`, admin.token)).json().usesOverride,
      ).toBe(true);

      const cleared = await call("DELETE", `/v1/admin/expenses/months/${thisMonth}`, admin.token);
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().usesOverride).toBe(false);
      expect(cleared.json().fixed).toHaveLength(2);

      expect(
        (await call("PUT", "/v1/admin/expenses/months/2999-01", admin.token, { fixedCosts: [] })).statusCode,
      ).toBe(400);
      const actions = (
        await db().select().from(adminActions).where(eq(adminActions.adminUserId, admin.id))
      ).map((a) => a.action);
      expect(actions).toEqual(
        expect.arrayContaining(["expenses_config_saved", "expenses_month_saved", "expenses_month_cleared"]),
      );
    });

    it("rejects bad rows", async () => {
      const bad = await call("PUT", "/v1/admin/expenses/config", admin.token, {
        fixedCosts: [{ name: "", amountMinor: -5, currency: "EUR", kind: "x" }],
        usdToIlsRate: 3.6,
      });
      expect(bad.statusCode).toBe(400);
    });
  });

  describe("security", () => {
    it("shows spend, the caps and the switch, and flips the switch for allow listed names only", async () => {
      const before = (await call("GET", "/v1/admin/security", admin.token)).json();
      expect(before.aiSpend).toMatchObject({ hourlyCapUsdMicros: 2_000_000, dailyCapUsdMicros: 10_000_000 });
      expect(before.aiSpend.todayUsdMicros).toBeGreaterThanOrEqual(1234);
      expect(before.switches).toEqual([{ name: "ai", enabled: true, reason: null, changedAt: null }]);

      const off = await call("PUT", "/v1/admin/switches/ai", admin.token, { enabled: false });
      expect(off.statusCode).toBe(200);
      expect(off.json()).toMatchObject({ name: "ai", enabled: false });
      expect(off.json().changedAt).not.toBeNull();
      expect((await call("GET", "/v1/admin/security", admin.token)).json().switches[0].enabled).toBe(false);

      expect((await call("PUT", "/v1/admin/switches/ai", admin.token, { enabled: "yes" })).statusCode).toBe(
        400,
      );
      expect(
        (await call("PUT", "/v1/admin/switches/everything", admin.token, { enabled: false })).statusCode,
      ).toBe(400);

      expect(
        (await call("PUT", "/v1/admin/switches/ai", admin.token, { enabled: true })).json().enabled,
      ).toBe(true);
      const audits = (
        await db().select().from(adminActions).where(eq(adminActions.adminUserId, admin.id))
      ).filter((a) => a.action === "switch_changed");
      expect(audits.length).toBeGreaterThanOrEqual(2);
    });
  });
});
