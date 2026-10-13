import {
  AFFINITIES_PER_FEATURE,
  AFFINITY_FLOOR,
  EVENT_RETENTION_DAYS,
  HALF_LIFE_DAYS,
  IMPRESSION_RETENTION_DAYS,
  SNAPSHOT_RETENTION_HOURS,
} from "@vinty/shared";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

type App = Pick<FastifyInstance, "db">;

/** Re-counts "popular this week". Cheap: a grouped read of the last 7 days of actions. */
export async function refreshPopularity(app: App): Promise<void> {
  await app.db.execute(sql`refresh materialized view concurrently listing_popularity_7d`);
}

export type CleanupResult = {
  events: number;
  impressions: number;
  snapshots: number;
  fadedAffinities: number;
  extraAffinities: number;
};

const rowCount = (result: unknown): number => {
  const r = result as { count?: number; length?: number };
  return typeof r.count === "number" ? r.count : (r.length ?? 0);
};

/**
 * The nightly chores: old actions (180 days, "card seen" 30 days), old saved lists, taste lines that faded below
 * 0.05, and anything past the top 50 lines of a feature. Safe to run twice.
 */
export async function cleanupFeedData(app: App, now = new Date()): Promise<CleanupResult> {
  const { db } = app;
  const eventCutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86_400_000);
  const impressionCutoff = new Date(now.getTime() - IMPRESSION_RETENTION_DAYS * 86_400_000);
  const snapshotCutoff = new Date(now.getTime() - SNAPSHOT_RETENTION_HOURS * 3_600_000);
  const effective = sql`score * power(0.5, extract(epoch from ${now.toISOString()}::timestamptz - scored_at) / (${HALF_LIFE_DAYS} * 86400))`;

  const events = await db.execute(
    sql`delete from user_events where occurred_at < ${eventCutoff.toISOString()}::timestamptz`,
  );
  const impressions = await db.execute(
    sql`delete from user_events where type = 'impression' and occurred_at < ${impressionCutoff.toISOString()}::timestamptz`,
  );
  const snapshots = await db.execute(
    sql`delete from feed_snapshots where created_at < ${snapshotCutoff.toISOString()}::timestamptz`,
  );
  const faded = await db.execute(sql`delete from user_affinities where ${effective} < ${AFFINITY_FLOOR}`);
  const extra = await db.execute(sql`
    delete from user_affinities a using (
      select user_id, feature, feature_key,
             row_number() over (partition by user_id, feature order by ${effective} desc) as rank
      from user_affinities
    ) r
    where a.user_id = r.user_id and a.feature = r.feature and a.feature_key = r.feature_key
      and r.rank > ${AFFINITIES_PER_FEATURE}`);
  return {
    events: rowCount(events),
    impressions: rowCount(impressions),
    snapshots: rowCount(snapshots),
    fadedAffinities: rowCount(faded),
    extraAffinities: rowCount(extra),
  };
}
