import { profiles } from "@vinty/db";
import { and, eq, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

/**
 * Is this seller away right now? A return date in the past counts as back, even before the daily job has switched
 * the flag off, so a once-a-day scheduler never leaves someone hidden past their date.
 */
export function isAway(enabled: boolean, endsAt: Date | null, now = new Date()): boolean {
  return enabled && (endsAt === null || endsAt.getTime() > now.getTime());
}

/** The same rule as SQL, for queries over the profiles table. */
export const awayNowSql = sql`(${profiles.holidayModeEnabled} and (${profiles.holidayEndsAt} is null or ${profiles.holidayEndsAt} > now()))`;

/** The daily chore: switch off away mode for everyone whose return date has passed. Safe to run twice. */
export async function endExpiredAwayMode(
  app: Pick<FastifyInstance, "db">,
  now = new Date(),
): Promise<number> {
  const ended = await app.db
    .update(profiles)
    .set({ holidayModeEnabled: false, holidayStartedAt: null, holidayEndsAt: null })
    .where(and(eq(profiles.holidayModeEnabled, true), lte(profiles.holidayEndsAt, now)))
    .returning({ userId: profiles.userId });
  return ended.length;
}

/** Is this seller in away mode right now? Uses the same rule as {@link isAway}. */
export async function isSellerAway(app: Pick<FastifyInstance, "db">, sellerId: string): Promise<boolean> {
  const [row] = await app.db
    .select({ enabled: profiles.holidayModeEnabled, endsAt: profiles.holidayEndsAt })
    .from(profiles)
    .where(eq(profiles.userId, sellerId))
    .limit(1);
  return row ? isAway(row.enabled, row.endsAt) : false;
}
