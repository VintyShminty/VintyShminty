import { listings } from "@vinty/db";
import {
  categoryTrail,
  type ReferenceData,
  SEARCH_INTENT_SAMPLE,
  type SearchFilters,
  searchIntent,
} from "@vinty/shared";
import { and, isNull, notInArray, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { searchConditions, sortSpec } from "./discovery.js";
import type { EventInput } from "./events.js";
import { searchPersonal } from "./feed.js";

type App = Pick<FastifyInstance, "db" | "storage" | "reference" | "log">;

/** `categoryIds` is empty when the search was about no category in particular, and holds up to three otherwise. */
export type SearchAbout = { categoryIds: string[]; brandId: string | undefined };

/**
 * What a search was about, so Home can learn from it (plan section 17.1). A category or a single brand the person
 * picked wins. Otherwise the best results of the search are read: "nike sneakers" finds mostly Nike sneakers, so the
 * search was about Nike and about sneakers. It reads results, not the meaning of words, so Hebrew and English work the
 * same. A search with no results, or with a bit of everything, is about nothing in particular.
 * When Home knows the person's shopping groups, the results inside those groups are read first: for a man, "sneakers"
 * is about men's sneakers, although the shop also has women's and kids' ones.
 * It never throws: learning must not break a search.
 */
export async function searchAbout(
  app: App,
  reference: ReferenceData,
  viewerId: string,
  queryText: string | null | undefined,
  filters: Partial<SearchFilters>,
): Promise<SearchAbout> {
  const picked: SearchAbout = {
    categoryIds: filters.categoryId ? [filters.categoryId] : [],
    brandId: filters.brandIds?.length === 1 ? filters.brandIds[0] : undefined,
  };
  if (picked.categoryIds.length > 0 && picked.brandId) return picked;
  try {
    const q = queryText?.trim() || undefined;
    const where = searchConditions({ ...filters, q }, reference, viewerId);
    const sort = sortSpec("relevance", q);
    const best = (extra: ReturnType<typeof or>) =>
      app.db
        .select({ categoryId: listings.categoryId, brandId: listings.brandId })
        .from(listings)
        .where(and(...where, extra))
        .orderBy(sql`${sort.key} desc, ${listings.id} desc`)
        .limit(SEARCH_INTENT_SAMPLE);
    const otherGroups = (await searchPersonal(app, viewerId, reference))?.otherGroupIds ?? [];
    let rows =
      otherGroups.length > 0
        ? await best(or(isNull(listings.categoryId), notInArray(listings.categoryId, otherGroups)))
        : [];
    if (rows.length === 0) rows = await best(undefined);
    const found = searchIntent(
      rows.map((r) => {
        const trail = r.categoryId ? categoryTrail(reference.categories, r.categoryId) : [];
        const names = trail.map((n) => n.name.en);
        return {
          trail: trail.map((n) => n.id),
          // The same steps without the top one, so sneakers under Women, Men and Kids count as one kind of item.
          kinds: names.map((_, depth) => names.slice(1, depth + 1).join(" > ")),
          brandId: r.brandId,
        };
      }),
    );
    return {
      categoryIds: picked.categoryIds.length > 0 ? picked.categoryIds : found.categoryIds,
      brandId: picked.brandId ?? found.brandId ?? undefined,
    };
  } catch (err) {
    app.log.error({ err }, "could not work out what a search was about");
    return picked;
  }
}

/**
 * The diary rows of one search: one per category it was about (the same kind of item under several groups), or a
 * single row when it was about a brand only or about nothing in particular.
 */
export function searchEvents(
  type: "search" | "save_search",
  about: SearchAbout,
  data: Record<string, unknown>,
): EventInput[] {
  const categories: (string | undefined)[] = about.categoryIds.length > 0 ? about.categoryIds : [undefined];
  return categories.map((categoryId) => ({ type, categoryId, brandId: about.brandId, data }));
}
