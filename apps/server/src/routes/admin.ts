import { expenseConfig, expenseMonths, killSwitches, users, verifications } from "@vinty/db";
import {
  adminAnalyticsSchema,
  adminDashboardSchema,
  adminExpensesQuerySchema,
  adminExpensesSchema,
  adminSecuritySchema,
  adminUsersPageSchema,
  adminUsersQuerySchema,
  errorResponseSchema,
  expenseConfigInputSchema,
  expenseMonthInputSchema,
  expenseMonthParamsSchema,
  idSchema,
  KILL_SWITCH_NAMES,
  type KillSwitch,
  killSwitchSchema,
  setRoleInputSchema,
  switchInputSchema,
  switchParamsSchema,
} from "@vinty/shared";
import { eq, like, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  currentMonth,
  isForeignKeyViolation,
  listUsers,
  loadAnalytics,
  loadDashboard,
  loadExpenses,
  writeAudit,
} from "../lib/admin.js";
import type { AiMeter } from "../lib/ai-cost.js";
import { ApiError } from "../lib/errors.js";

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};
const idParams = z.object({ id: idSchema });

/**
 * The admin panel API. Every route first checks, on the server, that the caller is signed in AND has the admin role
 * in the database (never what the browser says). Every change writes an `admin_actions` row in the same
 * transaction. Docs: docs/blueprint/api.md, "Admin panel".
 */
const adminRoutes: FastifyPluginAsyncZod<{ meter: AiMeter }> = async (app, { meter }) => {
  const db = app.db;

  const requireAdmin = async (
    request: Parameters<typeof app.requireUser>[0],
    reply: Parameters<typeof app.requireUser>[1],
  ) => {
    await app.requireUser(request, reply);
    const id = request.session?.user.id;
    if (!id) throw ApiError.unauthenticated();
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (row?.role !== "admin") throw ApiError.forbidden("Admins only");
  };
  const preHandler = requireAdmin;
  const rateLimit = { rateLimit: { max: 120, timeWindow: "1 minute" } };
  const adminIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/admin/dashboard",
    { preHandler, config: rateLimit, schema: { response: { 200: adminDashboardSchema, ...errors } } },
    async () => loadDashboard(db),
  );

  app.get(
    "/v1/admin/users",
    {
      preHandler,
      config: rateLimit,
      schema: { querystring: adminUsersQuerySchema, response: { 200: adminUsersPageSchema, ...errors } },
    },
    async (request) => listUsers(db, request.query),
  );

  app.post(
    "/v1/admin/users/:id/role",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: idParams,
        body: setRoleInputSchema,
        response: {
          200: z.object({ id: idSchema, role: z.enum(["user", "moderator", "admin"]) }),
          ...errors,
        },
      },
    },
    async (request) => {
      const adminId = adminIdOf(request);
      const { id } = request.params;
      const { role } = request.body;
      if (id === adminId && role !== "admin") {
        throw ApiError.conflict("You cannot remove your own admin access");
      }
      await db.transaction(async (tx) => {
        const [before] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
        if (!before) throw ApiError.notFound("No such person");
        await tx.update(users).set({ role }).where(eq(users.id, id));
        await writeAudit(tx, adminId, "user_role_changed", "user", id, { from: before.role, to: role });
      });
      return { id, role };
    },
  );

  app.delete(
    "/v1/admin/users/:id",
    {
      preHandler,
      config: rateLimit,
      schema: { params: idParams, response: { 204: z.null(), ...errors } },
    },
    async (request, reply) => {
      const adminId = adminIdOf(request);
      const { id } = request.params;
      if (id === adminId) throw ApiError.conflict("You cannot delete yourself");
      try {
        await db.transaction(async (tx) => {
          const [target] = await tx
            .select({ username: users.username, email: users.email })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
          if (!target) throw ApiError.notFound("No such person");
          // Everything that belongs to the person goes with them (the tables cascade). Codes sent to their email too.
          await tx.delete(verifications).where(like(verifications.identifier, `%${target.email}%`));
          await tx.delete(users).where(eq(users.id, id));
          await writeAudit(tx, adminId, "user_deleted", "user", id, {
            username: target.username,
            email: target.email,
          });
        });
      } catch (err) {
        // Orders and money rows keep their people. Such an account is banned or closed, not deleted.
        if (isForeignKeyViolation(err)) {
          throw ApiError.conflict(
            "This person has orders or money records and cannot be deleted. Ban them instead",
          );
        }
        throw err;
      }
      return reply.code(204).send(null);
    },
  );

  app.get(
    "/v1/admin/analytics",
    { preHandler, config: rateLimit, schema: { response: { 200: adminAnalyticsSchema, ...errors } } },
    async () => loadAnalytics(db),
  );

  app.get(
    "/v1/admin/expenses",
    {
      preHandler,
      config: rateLimit,
      schema: { querystring: adminExpensesQuerySchema, response: { 200: adminExpensesSchema, ...errors } },
    },
    async (request) => loadExpenses(db, request.query.month ?? currentMonth()),
  );

  app.put(
    "/v1/admin/expenses/config",
    {
      preHandler,
      config: rateLimit,
      schema: { body: expenseConfigInputSchema, response: { 200: adminExpensesSchema, ...errors } },
    },
    async (request) => {
      const adminId = adminIdOf(request);
      const { fixedCosts, usdToIlsRate } = request.body;
      const rate = Math.round(usdToIlsRate * 10_000);
      await db.transaction(async (tx) => {
        await tx
          .insert(expenseConfig)
          .values({ id: 1, fixedCosts, usdToIlsRateX10000: rate, updatedBy: adminId })
          .onConflictDoUpdate({
            target: expenseConfig.id,
            set: { fixedCosts, usdToIlsRateX10000: rate, updatedBy: adminId, updatedAt: sql`now()` },
          });
        await writeAudit(tx, adminId, "expenses_config_saved", "expenses", "defaults", {
          rows: fixedCosts.length,
          usdToIlsRate: rate / 10_000,
        });
      });
      return loadExpenses(db, currentMonth());
    },
  );

  app.put(
    "/v1/admin/expenses/months/:month",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: expenseMonthParamsSchema,
        body: expenseMonthInputSchema,
        response: { 200: adminExpensesSchema, ...errors },
      },
    },
    async (request) => {
      const adminId = adminIdOf(request);
      const { month } = request.params;
      if (month > currentMonth())
        throw ApiError.invalid("That month has not started yet", { month: "future" });
      const { fixedCosts } = request.body;
      await db.transaction(async (tx) => {
        await tx
          .insert(expenseMonths)
          .values({ month, fixedCosts, updatedBy: adminId })
          .onConflictDoUpdate({
            target: expenseMonths.month,
            set: { fixedCosts, updatedBy: adminId, updatedAt: sql`now()` },
          });
        await writeAudit(tx, adminId, "expenses_month_saved", "expenses", month, { rows: fixedCosts.length });
      });
      return loadExpenses(db, month);
    },
  );

  app.delete(
    "/v1/admin/expenses/months/:month",
    {
      preHandler,
      config: rateLimit,
      schema: { params: expenseMonthParamsSchema, response: { 200: adminExpensesSchema, ...errors } },
    },
    async (request) => {
      const adminId = adminIdOf(request);
      const { month } = request.params;
      if (month > currentMonth())
        throw ApiError.invalid("That month has not started yet", { month: "future" });
      await db.transaction(async (tx) => {
        await tx.delete(expenseMonths).where(eq(expenseMonths.month, month));
        await writeAudit(tx, adminId, "expenses_month_cleared", "expenses", month);
      });
      return loadExpenses(db, month);
    },
  );

  const loadSwitches = async (): Promise<KillSwitch[]> => {
    const rows = await db.select().from(killSwitches);
    return KILL_SWITCH_NAMES.map((name) => {
      const row = rows.find((r) => r.name === name);
      return {
        name,
        // A missing row means on.
        enabled: row?.enabled ?? true,
        reason: row?.reason ?? null,
        changedAt: row?.changedAt.toISOString() ?? null,
      };
    });
  };

  app.get(
    "/v1/admin/security",
    { preHandler, config: rateLimit, schema: { response: { 200: adminSecuritySchema, ...errors } } },
    async () => {
      const { hourMicros, dayMicros } = await meter.spend();
      return {
        aiSpend: {
          thisHourUsdMicros: hourMicros,
          todayUsdMicros: dayMicros,
          hourlyCapUsdMicros: meter.hourlyCapMicros,
          dailyCapUsdMicros: meter.dailyCapMicros,
        },
        switches: await loadSwitches(),
      };
    },
  );

  app.put(
    "/v1/admin/switches/:name",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: switchParamsSchema,
        body: switchInputSchema,
        response: { 200: killSwitchSchema, ...errors },
      },
    },
    async (request) => {
      const adminId = adminIdOf(request);
      const { name } = request.params;
      const { enabled } = request.body;
      const reason = enabled ? null : "Turned off by an admin";
      await db.transaction(async (tx) => {
        await tx
          .insert(killSwitches)
          .values({ name, enabled, reason, changedBy: adminId })
          .onConflictDoUpdate({
            target: killSwitches.name,
            set: { enabled, reason, changedBy: adminId, changedAt: sql`now()` },
          });
        await writeAudit(tx, adminId, "switch_changed", "switch", name, { enabled });
      });
      // This server copy sees the flip at once. Other copies read the switch again within 30 seconds.
      meter.invalidate();
      const switches = await loadSwitches();
      return switches.find((s) => s.name === name) as KillSwitch;
    },
  );
};

export default adminRoutes;
