import { and, eq, inArray, sql } from "drizzle-orm";
import {
  categories,
  feedHidden,
  listings,
  materials,
  savedSearches,
  userAffinities,
  userEvents,
} from "../schema/index.js";
import type { SeedDb } from "./connection.js";
import { categoryMoves, retiredGroups } from "./reference/category-moves.js";

export type MoveCounts = {
  /** Listings moved to a new category, per old slug. */
  listings: Record<string, number>;
  materialsSet: number;
  savedSearches: number;
  hiddenCategories: number;
  affinities: number;
  removedCategories: number;
};

/** Every old slug the move knows about, with the new slugs that replace it. */
const replacements = (): Map<string, string[]> => {
  const out = new Map<string, string[]>();
  for (const move of categoryMoves) out.set(move.from, [move.to]);
  for (const [group, to] of Object.entries(retiredGroups)) out.set(group, to);
  return out;
};

/**
 * Brings a database that still has the old clothing categories up to the new tree. Call it after the new categories
 * are in (`categoryId` has every slug of the new tree). Safe to run any number of times and on a database that never
 * had the old tree: it only touches rows that still point at an old category, and deletes an old category only when
 * nothing points at it. Everything happens in one transaction, so a failure leaves the database as it was.
 */
export async function moveCategories(db: SeedDb, categoryId: Map<string, string>): Promise<MoveCounts> {
  const counts: MoveCounts = {
    listings: {},
    materialsSet: 0,
    savedSearches: 0,
    hiddenCategories: 0,
    affinities: 0,
    removedCategories: 0,
  };
  const targets = replacements();
  for (const [from, to] of targets) {
    for (const slug of to) {
      if (!categoryId.has(slug))
        throw new Error(`Category move ${from} points at ${slug}, which is not in the tree`);
    }
  }

  await db.transaction(async (tx) => {
    const sourceSlugs = [...targets.keys()];
    const sourceRows = await tx
      .select({ id: categories.id, slug: categories.slug, depth: categories.depth })
      .from(categories)
      .where(inArray(categories.slug, sourceSlugs));
    const materialRows = await tx.select({ id: materials.id, slug: materials.slug }).from(materials);
    const materialId = new Map(materialRows.map((r) => [r.slug, r.id]));

    // Old id -> new ids, only for old rows that are going away (a slug the new tree still has keeps its id).
    const idMap = new Map<string, string[]>();
    const retiredIds: { id: string; depth: number }[] = [];
    for (const row of sourceRows) {
      if (categoryId.has(row.slug)) continue;
      retiredIds.push({ id: row.id, depth: row.depth });
      idMap.set(
        row.id,
        (targets.get(row.slug) ?? []).map((slug) => categoryId.get(slug) as string),
      );
    }

    // 1. Listings (and the history that remembers which category an event was about).
    for (const move of categoryMoves) {
      const from = sourceRows.find((r) => r.slug === move.from);
      const to = categoryId.get(move.to) as string;
      if (!from || from.id === to) continue;
      const mat = move.material ? materialId.get(move.material) : undefined;
      const moved = await tx
        .update(listings)
        .set({ categoryId: to })
        .where(eq(listings.categoryId, from.id))
        .returning({ id: listings.id });
      if (moved.length > 0) counts.listings[move.from] = (counts.listings[move.from] ?? 0) + moved.length;
      if (mat && moved.length > 0) {
        const set = await tx
          .update(listings)
          .set({ materialId: mat })
          .where(
            and(
              inArray(
                listings.id,
                moved.map((r) => r.id),
              ),
              sql`${listings.materialId} is null`,
            ),
          )
          .returning({ id: listings.id });
        counts.materialsSet += set.length;
      }
      await tx.update(userEvents).set({ categoryId: to }).where(eq(userEvents.categoryId, from.id));
    }

    if (idMap.size > 0) {
      const oldIds = [...idMap.keys()];

      // 2. Saved searches keep a list of category ids inside their filters.
      const searches = await tx
        .select({ id: savedSearches.id, filters: savedSearches.filters })
        .from(savedSearches)
        .where(sql`jsonb_typeof(${savedSearches.filters} -> 'categoryIds') = 'array'`);
      for (const search of searches) {
        const filters = search.filters as { categoryIds?: string[] };
        const ids = filters.categoryIds ?? [];
        if (!ids.some((id) => idMap.has(id))) continue;
        const next = [...new Set(ids.flatMap((id) => idMap.get(id) ?? [id]))];
        await tx
          .update(savedSearches)
          .set({ filters: { ...filters, categoryIds: next } })
          .where(eq(savedSearches.id, search.id));
        counts.savedSearches += 1;
      }

      // 3. "Not interested" in a category.
      const hidden = await tx
        .select()
        .from(feedHidden)
        .where(and(eq(feedHidden.scope, "category"), inArray(feedHidden.targetId, oldIds)));
      for (const row of hidden) {
        for (const target of idMap.get(row.targetId) ?? []) {
          await tx
            .insert(feedHidden)
            .values({ userId: row.userId, scope: "category", targetId: target })
            .onConflictDoNothing();
        }
        await tx.delete(feedHidden).where(eq(feedHidden.id, row.id));
        counts.hiddenCategories += 1;
      }

      // 4. Taste scores. The first new category inherits the score, the higher one wins if both exist.
      const scores = await tx
        .select()
        .from(userAffinities)
        .where(
          and(
            inArray(userAffinities.feature, ["category", "parent_category"]),
            inArray(userAffinities.featureKey, oldIds),
          ),
        );
      for (const row of scores) {
        const target = idMap.get(row.featureKey)?.[0];
        if (target) {
          await tx
            .insert(userAffinities)
            .values({ ...row, featureKey: target })
            .onConflictDoUpdate({
              target: [userAffinities.userId, userAffinities.feature, userAffinities.featureKey],
              set: {
                score: sql`greatest(${userAffinities.score}, excluded.score)`,
                eventCount: sql`${userAffinities.eventCount} + excluded.event_count`,
              },
            });
        }
        await tx
          .delete(userAffinities)
          .where(
            and(
              eq(userAffinities.userId, row.userId),
              eq(userAffinities.feature, row.feature),
              eq(userAffinities.featureKey, row.featureKey),
            ),
          );
        counts.affinities += 1;
      }

      // 5. Remove the old rows, deepest first, and only those nothing points at any more.
      const depths = [...new Set(retiredIds.map((r) => r.depth))].sort((a, b) => b - a);
      for (const depth of depths) {
        const ids = retiredIds.filter((r) => r.depth === depth).map((r) => r.id);
        const removed = await tx
          .delete(categories)
          .where(
            and(
              inArray(categories.id, ids),
              sql`not exists (select 1 from listings l where l.category_id = ${categories.id})`,
              sql`not exists (select 1 from categories c where c.parent_id = ${categories.id})`,
            ),
          )
          .returning({ id: categories.id });
        counts.removedCategories += removed.length;
      }
    }
  });
  return counts;
}
