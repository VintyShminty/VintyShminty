import {
  adminActions,
  aiCalls,
  type Database,
  expenseConfig,
  expenseItems,
  expenseMonths,
  listings,
  orders,
  sessions,
  standInSellers,
  users,
} from "@vinty/db";
import type {
  AdminAnalytics,
  AdminDashboard,
  AdminExpenses,
  AdminUser,
  AdminUsersPage,
  AdminUsersQuery,
} from "@vinty/shared";
import { type AnyColumn, and, count, desc, eq, gte, lt, or, type SQL, sql } from "drizzle-orm";
import { ApiError } from "./errors.js";
import { keysetCursor, olderThan, tsText } from "./keyset.js";

export type Db = NonNullable<Database["db"]>;
/** The query builder or a transaction, so an audit row can be written in the same transaction as the change. */
export type Writer = Pick<Db, "insert" | "select" | "update" | "delete">;

const DEFAULT_RATE_X10000 = 36000;
const iso = (value: Date | string) => new Date(value).toISOString();
const n = (value: unknown) => Number(value ?? 0);

/** The only way an admin change is recorded. Rows are added and never changed or removed. */
export async function writeAudit(
  db: Writer,
  adminUserId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  await db.insert(adminActions).values({ adminUserId, action, targetType, targetId, details });
}

const monthStartUtc = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);

/** The first moment of a YYYY-MM month and of the next one, in UTC. */
function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** The first day of the month after a YYYY-MM month, as YYYY-MM-DD. */
function monthEndDay(month: string): string {
  return monthRange(month).end.toISOString().slice(0, 10);
}

export async function loadDashboard(db: Db, now = new Date()): Promise<AdminDashboard> {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [[totals], [recentUsers], [active], [recentOrders], [aiMonth], [aiToday], recent] = await Promise.all(
    [
      db.select({ c: count() }).from(users),
      db
        .select({ c: count() })
        .from(users)
        .where(gte(users.createdAt, new Date(now.getTime() - 7 * 86_400_000))),
      db.select({ c: count() }).from(listings).where(eq(listings.status, "active")),
      db
        .select({ c: count() })
        .from(orders)
        .where(gte(orders.createdAt, new Date(now.getTime() - 30 * 86_400_000))),
      db
        .select({ s: sql<string>`coalesce(sum(${aiCalls.costUsdMicros}), 0)` })
        .from(aiCalls)
        .where(gte(aiCalls.createdAt, monthStartUtc(now))),
      db.select({ c: count() }).from(aiCalls).where(gte(aiCalls.createdAt, day)),
      db
        .select({ a: adminActions, username: users.username })
        .from(adminActions)
        .leftJoin(users, eq(users.id, adminActions.adminUserId))
        .orderBy(desc(adminActions.createdAt), desc(adminActions.id))
        .limit(20),
    ],
  );
  return {
    stats: {
      totalUsers: n(totals?.c),
      newUsersLast7Days: n(recentUsers?.c),
      activeListings: n(active?.c),
      ordersLast30Days: n(recentOrders?.c),
      aiSpendThisMonthUsdMicros: n(aiMonth?.s),
      aiCallsToday: n(aiToday?.c),
    },
    recentActions: recent.map(({ a, username }) => ({
      id: a.id,
      createdAt: a.createdAt.toISOString(),
      adminUsername: username,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      details: (a.details ?? {}) as Record<string, unknown>,
    })),
  };
}

/**
 * The id of the row being listed, written with its table name. Drizzle leaves the table name off in a query on one
 * table, and inside a subquery a bare "id" would then mean the subquery's own table.
 */
const outerUserId = sql.raw('"users"."id"');

/** Escapes % and _ so a search for them matches the characters themselves. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

export async function listUsers(db: Db, query: AdminUsersQuery): Promise<AdminUsersPage> {
  const filters: (SQL | undefined)[] = [olderThan(query.cursor, users.createdAt, users.id)];
  switch (query.filter) {
    case "admins":
      filters.push(eq(users.role, "admin"));
      break;
    case "banned":
      filters.push(eq(users.banned, true));
      break;
    case "sellers":
      filters.push(
        sql`exists (select 1 from ${listings} where ${listings.sellerId} = ${outerUserId} and ${listings.status} <> 'draft')`,
      );
      break;
    case "buyers":
      filters.push(sql`exists (select 1 from ${orders} where ${orders.buyerId} = ${outerUserId})`);
      break;
  }
  if (query.q) {
    const pattern = likePattern(query.q);
    filters.push(
      sql`(${users.username} ilike ${pattern} or ${users.name} ilike ${pattern} or ${users.email} ilike ${pattern})`,
    );
  }

  const rows = await db
    .select({
      user: users,
      cursorTs: tsText(users.createdAt),
      lastSignIn: sql<
        Date | string | null
      >`(select max(${sessions.createdAt}) from ${sessions} where ${sessions.userId} = ${outerUserId})`,
      listingCount: sql<number>`(select count(*)::int from ${listings} where ${listings.sellerId} = ${outerUserId} and ${listings.status} <> 'draft')`,
      isStandIn: sql<boolean>`exists (select 1 from ${standInSellers} where ${standInSellers.userId} = ${outerUserId})`,
    })
    .from(users)
    .where(and(...filters))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const items: AdminUser[] = page.map((r) => ({
    id: r.user.id,
    username: r.user.username,
    name: r.user.name,
    email: r.user.email,
    role: r.user.role,
    banned: r.user.banned,
    createdAt: r.user.createdAt.toISOString(),
    lastSignInAt: r.lastSignIn ? iso(r.lastSignIn) : null,
    listingCount: n(r.listingCount),
    isStandIn: Boolean(r.isStandIn),
  }));
  return {
    items,
    nextCursor: rows.length > query.limit && last ? keysetCursor(last.cursorTs, last.user.id) : null,
  };
}

/** The Mondays (UTC) of the last 8 weeks, oldest first, as YYYY-MM-DD. */
export function lastWeekStarts(now: Date, weeks = 8): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (new Date(today).getUTCDay() + 6) % 7;
  const thisMonday = today - daysSinceMonday * 86_400_000;
  return Array.from({ length: weeks }, (_, i) =>
    new Date(thisMonday - (weeks - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10),
  );
}

export async function loadAnalytics(db: Db, now = new Date()): Promise<AdminAnalytics> {
  const weekStarts = lastWeekStarts(now);
  const since = new Date(`${weekStarts[0]}T00:00:00Z`);
  const weekOf = (column: AnyColumn) =>
    sql<string>`to_char(date_trunc('week', ${column} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const weekly = async (
    table: typeof users | typeof listings | typeof orders,
    createdAt: AnyColumn,
    extra?: SQL,
  ) => {
    const rows = await db
      .select({ week: weekOf(createdAt), c: count() })
      .from(table)
      .where(and(gte(createdAt, since), extra))
      .groupBy(weekOf(createdAt));
    return new Map(rows.map((r) => [r.week, n(r.c)]));
  };
  const [signups, newListings, orderCounts, ai] = await Promise.all([
    weekly(users, users.createdAt),
    weekly(listings, listings.createdAt, sql`${listings.status} <> 'draft'`),
    weekly(orders, orders.createdAt),
    db
      .select({
        action: aiCalls.action,
        calls: count(),
        input: sql<string>`coalesce(sum(${aiCalls.inputTokens} + ${aiCalls.cacheReadTokens} + ${aiCalls.cacheWriteTokens}), 0)`,
        output: sql<string>`coalesce(sum(${aiCalls.outputTokens}), 0)`,
        cost: sql<string>`coalesce(sum(${aiCalls.costUsdMicros}), 0)`,
      })
      .from(aiCalls)
      .where(gte(aiCalls.createdAt, monthStartUtc(now)))
      .groupBy(aiCalls.action)
      .orderBy(desc(sql`sum(${aiCalls.costUsdMicros})`)),
  ]);
  return {
    weeks: weekStarts.map((weekStart) => ({
      weekStart,
      signups: signups.get(weekStart) ?? 0,
      newListings: newListings.get(weekStart) ?? 0,
      orders: orderCounts.get(weekStart) ?? 0,
    })),
    aiThisMonth: ai.map((r) => ({
      action: r.action,
      calls: n(r.calls),
      inputTokens: n(r.input),
      outputTokens: n(r.output),
      costUsdMicros: n(r.cost),
    })),
  };
}

/** What a fixed cost is worth in agorot. Dollar amounts (cents) are converted with the saved rate. */
const fixedInIls = (row: { amountMinor: number; currency: string }, rateX10000: number) =>
  row.currency === "ILS" ? row.amountMinor : (row.amountMinor * rateX10000) / 10_000;

export async function loadExpenses(db: Db, month: string, now = new Date()): Promise<AdminExpenses> {
  if (month > currentMonth(now))
    throw ApiError.invalid("That month has not started yet", { month: "future" });
  const { start, end } = monthRange(month);
  const inMonth = and(gte(aiCalls.createdAt, start), lt(aiCalls.createdAt, end));
  // Cached tokens count as input here, they were all sent to the model.
  const input = sql<string>`coalesce(sum(${aiCalls.inputTokens} + ${aiCalls.cacheReadTokens} + ${aiCalls.cacheWriteTokens}), 0)`;
  const output = sql<string>`coalesce(sum(${aiCalls.outputTokens}), 0)`;
  const cost = sql<string>`coalesce(sum(${aiCalls.costUsdMicros}), 0)`;
  const byCostDesc = desc(sql`sum(${aiCalls.costUsdMicros})`);

  const [[config], [override], byProvider, byAction, byModel, items, itemNames] = await Promise.all([
    db.select().from(expenseConfig).where(eq(expenseConfig.id, 1)).limit(1),
    db.select().from(expenseMonths).where(eq(expenseMonths.month, month)).limit(1),
    db
      .select({ provider: aiCalls.provider, calls: count(), input, output, cost })
      .from(aiCalls)
      .where(inMonth)
      .groupBy(aiCalls.provider)
      .orderBy(byCostDesc),
    db
      .select({ action: aiCalls.action, calls: count(), input, output, cost })
      .from(aiCalls)
      .where(inMonth)
      .groupBy(aiCalls.action)
      .orderBy(byCostDesc),
    db
      .select({ model: aiCalls.model, calls: count(), input, output, cost })
      .from(aiCalls)
      .where(inMonth)
      .groupBy(aiCalls.model)
      .orderBy(byCostDesc),
    // Yearly costs started on or before this month, one time costs paid in it.
    db
      .select()
      .from(expenseItems)
      .where(
        or(
          and(eq(expenseItems.cadence, "yearly"), lt(expenseItems.paidOn, monthEndDay(month))),
          and(
            eq(expenseItems.cadence, "one_time"),
            gte(expenseItems.paidOn, `${month}-01`),
            lt(expenseItems.paidOn, monthEndDay(month)),
          ),
        ),
      )
      .orderBy(expenseItems.paidOn, expenseItems.name),
    db.selectDistinct({ name: expenseItems.paidBy }).from(expenseItems),
  ]);

  const defaults = config?.fixedCosts ?? [];
  const rateX10000 = config?.usdToIlsRateX10000 ?? DEFAULT_RATE_X10000;
  const fixed = (override ? override.fixedCosts : defaults).map((row) => ({
    ...row,
    paidBy: row.paidBy ?? "",
  }));
  const toExtra = (row: (typeof items)[number]) => ({
    id: row.id,
    cadence: row.cadence as "yearly" | "one_time",
    name: row.name,
    amountMinor: row.amountMinor,
    currency: row.currency as "ILS" | "USD",
    paidBy: row.paidBy,
    paidOn: row.paidOn,
  });
  const yearly = items.filter((r) => r.cadence === "yearly").map(toExtra);
  const oneTime = items.filter((r) => r.cadence === "one_time").map(toExtra);
  const aiMicros = byProvider.reduce((sum, r) => sum + n(r.cost), 0);
  const totalIls =
    fixed.reduce((sum, row) => sum + fixedInIls(row, rateX10000), 0) +
    yearly.reduce((sum, row) => sum + fixedInIls(row, rateX10000) / 12, 0) +
    oneTime.reduce((sum, row) => sum + fixedInIls(row, rateX10000), 0) +
    (aiMicros * rateX10000) / 100_000_000;
  // Names people typed before, for the suggestions. Costs saved before the field existed have no name.
  const paidByNames = [
    ...new Set([
      ...itemNames.map((r) => r.name),
      ...defaults.map((r) => r.paidBy ?? ""),
      ...fixed.map((r) => r.paidBy),
    ]),
  ]
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return {
    month,
    usesOverride: Boolean(override),
    fixed,
    yearly,
    oneTime,
    paidByNames,
    auto: byProvider.map((r) => ({
      provider: r.provider,
      calls: n(r.calls),
      inputTokens: n(r.input),
      outputTokens: n(r.output),
      costUsdMicros: n(r.cost),
    })),
    byAction: byAction.map((r) => ({
      action: r.action,
      calls: n(r.calls),
      inputTokens: n(r.input),
      outputTokens: n(r.output),
      costUsdMicros: n(r.cost),
      averageCostUsdMicros: n(r.calls) > 0 ? Math.round(n(r.cost) / n(r.calls)) : 0,
    })),
    byModel: byModel.map((r) => ({
      model: r.model,
      calls: n(r.calls),
      inputTokens: n(r.input),
      outputTokens: n(r.output),
      costUsdMicros: n(r.cost),
    })),
    usdToIlsRate: rateX10000 / 10_000,
    totalIlsMinor: Math.round(totalIls),
    defaults: defaults.map((row) => ({ ...row, paidBy: row.paidBy ?? "" })),
  };
}

/** Whether a database error is a foreign key violation (the row is still needed by something else). */
export function isForeignKeyViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: string } | undefined)?.code;
  return code(err) === "23503" || code((err as { cause?: unknown } | undefined)?.cause) === "23503";
}

/** Whether a database error is a unique rule being broken (the same value already exists). */
export function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: string } | undefined)?.code;
  return code(err) === "23505" || code((err as { cause?: unknown } | undefined)?.cause) === "23505";
}
