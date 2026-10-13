import { type Database, orders, profiles, walletEntries } from "@vinty/db";
import { type Balance, type BalanceEntry, DEFAULT_CURRENCY } from "@vinty/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { ApiError } from "./errors.js";
import { keysetCursor, olderThan, tsText } from "./keyset.js";
import { isUniqueViolation } from "./offers.js";

type Db = NonNullable<Database["db"]>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Entry = typeof walletEntries.$inferSelect;

/** Pending is money for sales that are not complete yet. Available is what can be withdrawn. Both are sums of ledger rows. */
export async function loadBalance(db: Db | Tx, userId: string): Promise<Balance> {
  const [row] = await db
    .select({
      pending: sql<number>`coalesce(sum(${walletEntries.amountMinor}) filter (where ${walletEntries.status} = 'pending'), 0)::int`,
      available: sql<number>`coalesce(sum(${walletEntries.amountMinor}) filter (where ${walletEntries.status} = 'available'), 0)::int`,
    })
    .from(walletEntries)
    .where(and(eq(walletEntries.userId, userId), eq(walletEntries.currency, DEFAULT_CURRENCY)));
  return { pending: row?.pending ?? 0, available: row?.available ?? 0, currency: DEFAULT_CURRENCY };
}

/** Inside the payment: the seller's pending credit. One per order, so a retry cannot credit twice. */
export async function creditSale(
  tx: Tx,
  input: { sellerId: string; orderId: string; amountMinor: number; currency: string; description: string },
) {
  if (input.amountMinor <= 0) return;
  await tx
    .insert(walletEntries)
    .values({
      userId: input.sellerId,
      type: "sale_credit",
      status: "pending",
      amountMinor: input.amountMinor,
      currency: input.currency,
      orderId: input.orderId,
      description: input.description,
    })
    .onConflictDoNothing();
}

/** The sale completed: the pending credit becomes available. Returns the amount released, 0 when there was nothing. */
export async function releaseSale(tx: Tx, sellerId: string, orderId: string, now: Date): Promise<number> {
  const rows = await tx
    .update(walletEntries)
    .set({ status: "available", availableAt: now })
    .where(
      and(
        eq(walletEntries.userId, sellerId),
        eq(walletEntries.orderId, orderId),
        eq(walletEntries.type, "sale_credit"),
        eq(walletEntries.status, "pending"),
      ),
    )
    .returning({ amountMinor: walletEntries.amountMinor });
  return rows.reduce((sum, r) => sum + r.amountMinor, 0);
}

/** The order was cancelled or refunded: the credit never becomes money. */
export async function voidSale(tx: Tx, sellerId: string, orderId: string): Promise<void> {
  await tx
    .update(walletEntries)
    .set({ status: "void" })
    .where(
      and(
        eq(walletEntries.userId, sellerId),
        eq(walletEntries.orderId, orderId),
        eq(walletEntries.type, "sale_credit"),
        eq(walletEntries.status, "pending"),
      ),
    );
}

export function presentEntry(row: Entry, orderNumber: number | null): BalanceEntry {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amountMinor: row.amountMinor,
    currency: row.currency,
    description: row.description,
    orderId: row.orderId,
    orderNumber,
    month: row.createdAt.toISOString().slice(0, 7),
    createdAt: row.createdAt.toISOString(),
    availableAt: row.availableAt?.toISOString() ?? null,
  };
}

export async function listEntries(db: Db, userId: string, cursor: string | undefined, limit: number) {
  const rows = await db
    .select({ e: walletEntries, orderNumber: orders.orderNumber, cursorTs: tsText(walletEntries.createdAt) })
    .from(walletEntries)
    .leftJoin(orders, eq(orders.id, walletEntries.orderId))
    .where(
      and(eq(walletEntries.userId, userId), olderThan(cursor, walletEntries.createdAt, walletEntries.id)),
    )
    .orderBy(desc(walletEntries.createdAt), desc(walletEntries.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => presentEntry(r.e, r.orderNumber)),
    nextCursor: rows.length > limit && last ? keysetCursor(last.cursorTs, last.e.id) : null,
  };
}

/**
 * Pretend withdrawal: a negative available row, no bank is contacted. Two withdrawals at once cannot overdraw,
 * because the person's profile row is locked while the balance is read and the row is written.
 */
export async function withdraw(
  db: Db,
  userId: string,
  amountMinor: number,
  idempotencyKey: string | undefined,
): Promise<{ entry: BalanceEntry; created: boolean }> {
  const find = async () => {
    if (!idempotencyKey) return undefined;
    const [row] = await db
      .select()
      .from(walletEntries)
      .where(and(eq(walletEntries.userId, userId), eq(walletEntries.idempotencyKey, idempotencyKey)))
      .limit(1);
    return row;
  };
  const existing = await find();
  if (existing) return { entry: presentEntry(existing, null), created: false };

  try {
    const row = await db.transaction(async (tx) => {
      await tx
        .select({ id: profiles.userId })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .for("update");
      const balance = await loadBalance(tx, userId);
      if (amountMinor > balance.available) {
        throw ApiError.invalid("There is not enough in your balance", {
          amountMinor: "validation.withdrawal.tooMuch",
        });
      }
      const [inserted] = await tx
        .insert(walletEntries)
        .values({
          userId,
          type: "withdrawal",
          status: "available",
          amountMinor: -amountMinor,
          currency: balance.currency,
          description: "Withdrawal (simulated)",
          availableAt: new Date(),
          idempotencyKey: idempotencyKey ?? null,
        })
        .returning();
      if (!inserted) throw new Error("Withdrawal was not saved");
      return inserted;
    });
    return { entry: presentEntry(row, null), created: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const again = await find();
      if (again) return { entry: presentEntry(again, null), created: false };
    }
    throw err;
  }
}
