import { brands } from "@vinty/db";
import type { CategoryNode, ReferenceData } from "@vinty/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  signUpTestUser,
  type TestContext,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated database that has the reference data (pnpm db:seed:reference).
describe.skipIf(!databaseUrl)("brand search", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  let reference: ReferenceData;
  let sized: CategoryNode;
  let seller: { token: string; id: string };
  let kors: { id: string };
  let zorblax: { id: string };
  const stamp = Date.now().toString(36);

  const get = (url: string) => ctx.app.inject({ method: "GET", url });
  const q = (text: string) => encodeURIComponent(text);
  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));

  let photoCounter = 0;
  async function publish(over: Record<string, unknown>) {
    photoCounter += 1;
    const group = reference.sizeGroups.find((g) => sized.sizeGroupIds.includes(g.id));
    const photo = (n: number) => ({
      key: `listings/${seller.id}/brand-${stamp}-${photoCounter}-${n}.jpg`,
      width: 900,
      height: 1200,
    });
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/listings",
      headers: bearer(seller.token),
      payload: {
        title: `Linen top ${stamp}`,
        description: "Worn twice",
        categoryId: sized.id,
        sizeId: group?.sizes[0]?.id,
        conditionId: reference.conditions[0]?.id,
        colourIds: [reference.colours[0]?.id],
        priceMinor: 12000,
        parcelSizeId: reference.parcelSizes[0]?.id,
        photos: [photo(1), photo(2)],
        publish: true,
        ...over,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json() as { id: string };
  }

  beforeAll(async () => {
    // A brand a seller added, with no Hebrew name yet. Added before the first search so the brand list picks it up.
    ctx = await buildTestApp();
    const { db } = ctx.database;
    await db.insert(brands).values({ slug: "zorblax", name: "Zorblax" }).onConflictDoNothing();
    zorblax = (await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, "zorblax")))[0] as {
      id: string;
    };
    reference = (await get("/v1/reference")).json();
    sized = leaves(reference.categories).find(
      (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
    ) as CategoryNode;
    kors = (await get(`/v1/brands?q=${q("Michael Kors")}`)).json().items[0];
    seller = (await signUpTestUser(ctx, "brandy", createdIds)) as { token: string; id: string };
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.database.db.delete(brands).where(eq(brands.slug, "zorblax"));
    await ctx.close();
  });

  const spellings = [
    "MICHAEL KORS",
    "michael kors",
    "MiChAeL kOrS",
    "  michael   kors ",
    "מייקל קורס",
    "מייקל",
    "MK",
    "michaelkors",
    "michal kors",
  ];

  describe("the brand picker", () => {
    it.each(spellings)("finds Michael Kors for %j", async (text) => {
      const res = await get(`/v1/brands?q=${q(text.trim())}`);
      expect(res.statusCode).toBe(200);
      expect(res.json().items.map((b: { name: string }) => b.name)).toContain("Michael Kors");
    });

    it("keeps the brand name properly capitalised", async () => {
      const items = (await get(`/v1/brands?q=${q("michael kors")}`)).json().items;
      expect(items[0].name).toBe("Michael Kors");
    });

    it("finds a brand with no Hebrew name by how the Hebrew sounds", async () => {
      const items = (await get(`/v1/brands?q=${q("זורבלקס")}`)).json().items;
      expect(items.map((b: { id: string }) => b.id)).toEqual([zorblax.id]);
    });

    it("finds nothing for a word that is no brand", async () => {
      expect((await get(`/v1/brands?q=${q("qqqxyz")}`)).json().items).toEqual([]);
    });
  });

  describe("the search", () => {
    let korsItem: { id: string };
    let zorblaxItem: { id: string };
    let typedItem: { id: string };

    beforeAll(async () => {
      korsItem = await publish({ brandId: kors.id });
      zorblaxItem = await publish({ brandId: zorblax.id, title: `Cotton shirt ${stamp}` });
      typedItem = await publish({ brandName: `Zorblax`, title: `Wool scarf ${stamp}` });
    });

    it.each(spellings)("reaches Michael Kors items for %j", async (text) => {
      const res = await get(`/v1/listings?q=${q(text.trim())}`);
      expect(res.statusCode).toBe(200);
      expect(res.json().items.map((i: { id: string }) => i.id)).toContain(korsItem.id);
      const count = await get(`/v1/listings/count?q=${q(text.trim())}`);
      expect(count.json().total).toBeGreaterThanOrEqual(1);
    });

    it("reaches the items of a brand with no Hebrew name", async () => {
      const found = (await get(`/v1/listings?q=${q("זורבלקס")}`))
        .json()
        .items.map((i: { id: string }) => i.id);
      expect(found).toContain(zorblaxItem.id);
      expect(found).not.toContain(korsItem.id);
      // Brand typed by the seller, saved under the same brand when the item went live.
      expect(found).toContain(typedItem.id);
    });

    it("still searches the words when they are more than a brand", async () => {
      const found = (await get(`/v1/listings?q=${q(`michael kors zzzznothing${stamp}`)}`)).json().items;
      expect(found).toEqual([]);
    });
  });
});
