import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  categories,
  feedHidden,
  listings,
  materials,
  savedSearches,
  userAffinities,
  users,
} from "../schema/index.js";
import legacy from "../test-fixtures/legacy-clothing-categories.json" with { type: "json" };
import { connect } from "./connection.js";
import { flattenCategories } from "./reference/categories.js";
import { categoryMoves, retiredGroups } from "./reference/category-moves.js";
import { seedReference } from "./reference.js";

type Legacy = {
  slug: string;
  parentSlug: string | null;
  path: string;
  depth: number;
  en: string;
  he: string;
  isLeaf: boolean;
};
const oldTree = legacy as Legacy[];
const tree = new Map(flattenCategories().map((c) => [c.slug, c]));
const moveFrom = new Map(categoryMoves.map((m) => [m.from, m]));

describe("category move list", () => {
  it("sends every move to a leaf of the new tree", () => {
    for (const move of categoryMoves) {
      expect(tree.get(move.to)?.isLeaf, move.to).toBe(true);
    }
  });

  it("only moves from categories that are gone or are no longer leaves", () => {
    for (const move of categoryMoves) {
      const now = tree.get(move.from);
      expect(now === undefined || !now.isLeaf, move.from).toBe(true);
    }
  });

  it("sends retired groups to groups that exist", () => {
    for (const [group, to] of Object.entries(retiredGroups)) {
      expect(tree.has(group), `${group} should be gone`).toBe(false);
      for (const slug of to) expect(tree.has(slug), slug).toBe(true);
    }
  });

  it("covers every old clothing leaf, so no listing is left behind", () => {
    const lost = oldTree
      .filter((c) => c.isLeaf)
      .filter((c) => !moveFrom.has(c.slug) && !tree.get(c.slug)?.isLeaf)
      .map((c) => c.slug);
    expect(lost).toEqual([]);
  });

  it("knows every old group that is gone", () => {
    const missing = oldTree
      .filter((c) => !c.isLeaf && !tree.has(c.slug) && !(c.slug in retiredGroups))
      .map((c) => c.slug);
    expect(missing).toEqual([]);
  });

  it("keeps every old leaf that stays a leaf in the new tree", () => {
    // These listings never move, so the slug must still be a leaf with the same meaning.
    for (const c of oldTree.filter((x) => x.isLeaf && !moveFrom.has(x.slug))) {
      expect(tree.get(c.slug)?.isLeaf, c.slug).toBe(true);
    }
  });
});

// Needs a migrated database (DATABASE_URL), like the smoke test. It puts the old clothing categories back, adds
// listings on every one, runs the reference seed and checks where everything landed.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)("moving listings to the new categories", () => {
  const { db, close } = connect(url);
  const stamp = Date.now();
  let sellerId = "";
  const listingBySlug = new Map<string, string>();

  beforeAll(async () => {
    await seedReference(db);
    const [user] = await db
      .insert(users)
      .values({ name: "Move test", email: `move-test-${stamp}@example.test` })
      .returning({ id: users.id });
    sellerId = (user as { id: string }).id;

    // Put the old rows back, parents first. A slug that still exists in the new tree keeps its row.
    const ids = new Map(
      (await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((r) => [
        r.slug,
        r.id,
      ]),
    );
    for (const c of oldTree) {
      if (ids.has(c.slug)) continue;
      const [row] = await db
        .insert(categories)
        .values({
          parentId: c.parentSlug ? (ids.get(c.parentSlug) ?? null) : null,
          slug: c.slug,
          path: c.path,
          depth: c.depth,
          nameEn: c.en,
          nameHe: c.he,
          isLeaf: c.isLeaf,
        })
        .returning({ id: categories.id });
      ids.set(c.slug, (row as { id: string }).id);
    }

    // One listing on each old leaf (the linen one has a cotton twin, to show a chosen material is kept).
    const cotton = (
      await db.select({ id: materials.id }).from(materials).where(eq(materials.slug, "cotton"))
    )[0]?.id;
    for (const c of oldTree.filter((x) => x.isLeaf)) {
      const [row] = await db
        .insert(listings)
        .values({ sellerId, title: `move-test ${c.slug}`, categoryId: ids.get(c.slug) as string })
        .returning({ id: listings.id });
      listingBySlug.set(c.slug, (row as { id: string }).id);
    }
    await db.insert(listings).values({
      sellerId,
      title: "move-test linen cotton",
      categoryId: ids.get("men-clothing-shirts-linen") as string,
      materialId: cotton,
    });

    await db.insert(savedSearches).values({
      userId: sellerId,
      filters: {
        sort: "relevance",
        categoryIds: [ids.get("women-clothing-outerwear"), ids.get("women-clothing-dresses")],
      },
    });
    await db.insert(feedHidden).values({
      userId: sellerId,
      scope: "category",
      targetId: ids.get("men-clothing-outerwear-jackets") as string,
    });
    await db.insert(userAffinities).values({
      userId: sellerId,
      feature: "category",
      featureKey: ids.get("women-clothing-knitwear-hoodies") as string,
      score: 2,
      eventCount: 3,
    });
  });

  afterAll(async () => {
    if (sellerId) await db.delete(users).where(eq(users.id, sellerId));
    await close();
  });

  const slugOfListing = async (id: string) => {
    const [row] = await db
      .select({ slug: categories.slug })
      .from(listings)
      .innerJoin(categories, eq(categories.id, listings.categoryId))
      .where(eq(listings.id, id));
    return row?.slug;
  };

  it("moves every listing where the list says and removes the old rows", async () => {
    const first = await seedReference(db);
    expect(first.listings_moved).toBeGreaterThanOrEqual(categoryMoves.length);

    for (const [slug, id] of listingBySlug) {
      const expected = moveFrom.get(slug)?.to ?? slug;
      expect(await slugOfListing(id), slug).toBe(expected);
    }
    const left = await db
      .select({ slug: categories.slug })
      .from(categories)
      .where(
        inArray(
          categories.slug,
          [...moveFrom.keys(), ...Object.keys(retiredGroups)].filter((s) => !tree.has(s)),
        ),
      );
    expect(left).toEqual([]);
    // Nothing sits on a category that is not a leaf.
    const onBranch = await db
      .select({ id: listings.id })
      .from(listings)
      .innerJoin(categories, eq(categories.id, listings.categoryId))
      .where(and(eq(listings.sellerId, sellerId), eq(categories.isLeaf, false)));
    expect(onBranch).toEqual([]);
  });

  it("sets Linen and Denim only where the seller chose nothing", async () => {
    const material = async (id: string) => {
      const [row] = await db
        .select({ slug: materials.slug })
        .from(listings)
        .innerJoin(materials, eq(materials.id, listings.materialId))
        .where(eq(listings.id, id));
      return row?.slug;
    };
    expect(await material(listingBySlug.get("men-clothing-shirts-linen") as string)).toBe("linen");
    expect(await material(listingBySlug.get("women-clothing-jeans-denim-shorts") as string)).toBe("denim");
    expect(await material(listingBySlug.get("men-clothing-shirts-casual") as string)).toBeUndefined();
    const [twin] = await db
      .select({ slug: materials.slug })
      .from(listings)
      .innerJoin(materials, eq(materials.id, listings.materialId))
      .where(and(eq(listings.sellerId, sellerId), eq(listings.title, "move-test linen cotton")));
    expect(twin?.slug).toBe("cotton");
  });

  it("points saved searches, hidden categories and taste at the new categories", async () => {
    const ids = new Map(
      (await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((r) => [
        r.slug,
        r.id,
      ]),
    );
    const [search] = await db.select().from(savedSearches).where(eq(savedSearches.userId, sellerId));
    const wanted = [...(retiredGroups["women-clothing-outerwear"] ?? []), "women-clothing-dresses"].map((s) =>
      ids.get(s),
    );
    expect(((search?.filters ?? {}) as { categoryIds?: string[] }).categoryIds?.sort()).toEqual(
      wanted.sort(),
    );
    const [hidden] = await db.select().from(feedHidden).where(eq(feedHidden.userId, sellerId));
    expect(hidden?.targetId).toBe(ids.get("men-clothing-jackets-other"));
    const [taste] = await db.select().from(userAffinities).where(eq(userAffinities.userId, sellerId));
    expect(taste?.featureKey).toBe(ids.get("women-clothing-sweatshirts-sweatshirts"));
    expect(taste?.eventCount).toBe(3);
  });

  it("changes nothing when run again", async () => {
    const again = await seedReference(db);
    expect(again.listings_moved).toBe(0);
    expect(again.old_categories_removed).toBe(0);
    for (const [slug, id] of listingBySlug) {
      expect(await slugOfListing(id), slug).toBe(moveFrom.get(slug)?.to ?? slug);
    }
  });
});
