import {
  type AffinityDelta,
  affinityDeltas,
  EVENT_WEIGHTS,
  HALF_LIFE_DAYS,
  type UserEventType,
} from "@vinty/shared";
import { sql } from "drizzle-orm";
import { categories, userAffinities, userEvents } from "../../schema/index.js";
import type { SeedDb } from "../connection.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Row = typeof userEvents.$inferInsert;

export interface BehaviourItem {
  id: string;
  sellerId: string;
  categoryId: string | null;
  brandId: string | null;
  sizeId: string | null;
  conditionId: string | null;
  priceMinor: number | null;
  colourIds: string[];
}

/**
 * Gives one person clear taste: they heart, open and come back to Zara dresses, so their home feed visibly leans
 * that way. Written the way the server writes it (the same weights and the same fading), so the taste sheet
 * and the diary agree. Returns how many diary rows and taste lines were written.
 */
export async function seedBehaviour(
  db: SeedDb,
  opts: {
    userId: string;
    now: Date;
    /** The Zara dresses the person engages with, best first. */
    favourite: BehaviourItem[];
    /** A few other things they looked at once. */
    glanced: BehaviourItem[];
    searchBrandId: string | null;
    searchCategoryId: string | null;
  },
): Promise<{ events: number; affinities: number }> {
  const categoryRows = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories);
  const parentOf = new Map(categoryRows.map((c) => [c.id, c.parentId]));
  const parents = (categoryId: string | null): string[] => {
    const out: string[] = [];
    let current = categoryId ? parentOf.get(categoryId) : null;
    while (current) {
      out.push(current);
      current = parentOf.get(current);
    }
    return out;
  };

  const ago = (days: number, hours = 0) => new Date(opts.now.getTime() - days * DAY - hours * HOUR);
  const log: { row: Row; deltas: AffinityDelta[] }[] = [];
  const add = (type: UserEventType, item: BehaviourItem, at: Date, data: Record<string, unknown> = {}) => {
    const band = item.priceMinor;
    log.push({
      row: {
        userId: opts.userId,
        type,
        listingId: item.id,
        categoryId: item.categoryId,
        brandId: item.brandId,
        sizeId: item.sizeId,
        sellerId: item.sellerId,
        priceBand:
          band === null
            ? null
            : band < 5000
              ? 0
              : band < 10000
                ? 1
                : band < 20000
                  ? 2
                  : band < 40000
                    ? 3
                    : band < 80000
                      ? 4
                      : 5,
        data,
        occurredAt: at,
      },
      deltas: affinityDeltas(EVENT_WEIGHTS[type], {
        categoryId: item.categoryId,
        parentCategoryIds: parents(item.categoryId),
        brandId: item.brandId,
        sellerId: item.sellerId,
        sizeId: item.sizeId,
        priceMinor: item.priceMinor,
        colourIds: item.colourIds,
        conditionId: item.conditionId,
      }),
    });
  };

  opts.favourite.forEach((item, i) => {
    add("listing_open", item, ago(Math.min(6, i % 7), 2 + (i % 5)));
    if (i < 6) add("favourite", item, ago(Math.min(5, i % 6), 1 + (i % 3)));
    if (i < 5) add("listing_open_repeat", item, ago(i % 3, i));
    if (i < 3) add("listing_dwell", item, ago(i % 3, 3 + i), { dwellMs: 14000 + i * 3000, photosSwiped: 3 });
    for (let n = 0; n < 2; n++) add("impression", item, ago(i % 5, n * 3));
  });
  for (const item of opts.glanced) add("listing_open", item, ago(4));
  if (opts.searchBrandId || opts.searchCategoryId) {
    log.push({
      row: {
        userId: opts.userId,
        type: "search",
        categoryId: opts.searchCategoryId,
        brandId: opts.searchBrandId,
        data: { q: "zara dress" },
        occurredAt: ago(2, 5),
      },
      deltas: affinityDeltas(EVENT_WEIGHTS.search, {
        categoryId: opts.searchCategoryId,
        parentCategoryIds: parents(opts.searchCategoryId),
        brandId: opts.searchBrandId,
      }),
    });
  }
  log.sort((a, b) => (a.row.occurredAt as Date).getTime() - (b.row.occurredAt as Date).getTime());

  // The same math the server runs on every action: fade the old score, then add the new one.
  const sheet = new Map<
    string,
    { feature: AffinityDelta["feature"]; key: string; score: number; at: Date; n: number }
  >();
  for (const { row, deltas } of log) {
    const at = row.occurredAt as Date;
    for (const d of deltas) {
      const id = `${d.feature}:${d.key}`;
      const line = sheet.get(id);
      const faded = line
        ? line.score * 0.5 ** ((at.getTime() - line.at.getTime()) / (HALF_LIFE_DAYS * DAY))
        : 0;
      sheet.set(id, {
        feature: d.feature,
        key: d.key,
        score: Math.max(0, faded + d.delta),
        at,
        n: (line?.n ?? 0) + 1,
      });
    }
  }

  await db.insert(userEvents).values(log.map((l) => l.row));
  await db.insert(userAffinities).values(
    [...sheet.values()].map((l) => ({
      userId: opts.userId,
      feature: l.feature,
      featureKey: l.key,
      score: l.score,
      scoredAt: l.at,
      eventCount: l.n,
    })),
  );
  await db.execute(sql`refresh materialized view listing_popularity_7d`);
  return { events: log.length, affinities: sheet.size };
}
