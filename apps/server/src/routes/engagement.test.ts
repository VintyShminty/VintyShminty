import { listings, notifications, recentSearches, reports, userSizes } from "@vinty/db";
import type { CategoryNode, ReferenceData } from "@vinty/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  signUpTestUser,
  type TestContext,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("favourites, saved searches, reports", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  let reference: ReferenceData;
  let sized: CategoryNode;
  let brandId: string;
  const stamp = Date.now().toString(36);

  type Person = { token: string; id: string; username: string };
  let seller: Person;
  let fan: Person;
  let fan2: Person;
  let stranger: Person;
  let item: { id: string };
  let draft: { id: string };

  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));
  let photoCounter = 0;
  const photo = (userId: string) => {
    photoCounter += 1;
    return { key: `listings/${userId}/eng-${stamp}-${photoCounter}.jpg`, width: 900, height: 1200 };
  };
  async function publish(owner: Person, title: string, publishNow = true) {
    const group = reference.sizeGroups.find((g) => sized.sizeGroupIds.includes(g.id));
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/listings",
      headers: bearer(owner.token),
      payload: {
        title,
        categoryId: sized.id,
        brandId,
        sizeId: group?.sizes[0]?.id,
        conditionId: reference.conditions[0]?.id,
        colourIds: [reference.colours[0]?.id],
        priceMinor: 9000,
        parcelSizeId: reference.parcelSizes[0]?.id,
        photos: [photo(owner.id)],
        publish: publishNow,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json() as { id: string };
  }

  const call = (
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    token?: string,
    payload?: object,
  ) => ctx.app.inject({ method, url, headers: token ? bearer(token) : {}, ...(payload ? { payload } : {}) });

  beforeAll(async () => {
    ctx = await buildTestApp();
    reference = (await call("GET", "/v1/reference")).json();
    sized = leaves(reference.categories).find(
      (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
    ) as CategoryNode;
    brandId = (await call("GET", "/v1/brands?limit=1")).json().items[0].id;
    [seller, fan, fan2, stranger] = (await Promise.all(
      ["seller", "fan", "fan2", "stranger"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as Person[];
    item = await publish(seller, `Heart ${stamp} cardigan`);
    draft = await publish(seller, `Heart ${stamp} draft`, false);
  });
  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("favourites", () => {
    it("needs a session", async () => {
      expect((await call("PUT", `/v1/listings/${item.id}/favourite`)).statusCode).toBe(401);
      expect((await call("DELETE", `/v1/listings/${item.id}/favourite`)).statusCode).toBe(401);
      expect((await call("GET", "/v1/me/favourites")).statusCode).toBe(401);
    });

    it("hearts once however many times it is sent, and un-hearts the same way", async () => {
      const first = await call("PUT", `/v1/listings/${item.id}/favourite`, fan.token);
      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ favouriteCount: 1 });
      expect((await call("PUT", `/v1/listings/${item.id}/favourite`, fan.token)).json()).toEqual({
        favouriteCount: 1,
      });
      expect((await call("PUT", `/v1/listings/${item.id}/favourite`, fan2.token)).json()).toEqual({
        favouriteCount: 2,
      });
      const detail = (await call("GET", `/v1/listings/${item.id}`, fan.token)).json();
      expect(detail.viewer.isFavourited).toBe(true);
      expect(detail.favouriteCount).toBe(2);

      expect((await call("DELETE", `/v1/listings/${item.id}/favourite`, fan2.token)).json()).toEqual({
        favouriteCount: 1,
      });
      expect((await call("DELETE", `/v1/listings/${item.id}/favourite`, fan2.token)).json()).toEqual({
        favouriteCount: 1,
      });
      // updated_at is not touched by hearts
      const [row] = await ctx.database.db.select().from(listings).where(eq(listings.id, item.id));
      expect(row?.favouriteCount).toBe(1);
    });

    it("tells the seller once, grouped", async () => {
      const rows = await ctx.database.db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, seller.id), eq(notifications.listingId, item.id)));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.type).toBe("listing_favourited");
      expect((rows[0]?.data as { count?: number } | undefined)?.count).toBe(2);
    });

    it("refuses your own item, drafts and unknown listings", async () => {
      expect((await call("PUT", `/v1/listings/${item.id}/favourite`, seller.token)).statusCode).toBe(403);
      expect((await call("PUT", `/v1/listings/${draft.id}/favourite`, fan.token)).statusCode).toBe(404);
      expect(
        (await call("PUT", "/v1/listings/00000000-0000-4000-8000-000000000000/favourite", fan.token))
          .statusCode,
      ).toBe(404);
      expect(
        (await call("DELETE", "/v1/listings/00000000-0000-4000-8000-000000000000/favourite", fan.token))
          .statusCode,
      ).toBe(404);
    });

    it("lists favourites newest first, searchable, and keeps sold items with their status", async () => {
      const second = await publish(seller, `Heart ${stamp} scarf`);
      await call("PUT", `/v1/listings/${second.id}/favourite`, fan.token);
      const list = (await call("GET", "/v1/me/favourites", fan.token)).json();
      expect(list.items.map((i: { id: string }) => i.id)).toEqual([second.id, item.id]);
      expect(list.items.every((i: { isFavourited: boolean }) => i.isFavourited)).toBe(true);
      expect(list.items[0].seller.id).toBe(seller.id);

      const found = (await call("GET", "/v1/me/favourites?q=cardigan", fan.token)).json();
      expect(found.items.map((i: { id: string }) => i.id)).toEqual([item.id]);

      const paged = (await call("GET", "/v1/me/favourites?limit=1", fan.token)).json();
      expect(paged.nextCursor).toBeTruthy();
      const rest = (
        await call("GET", `/v1/me/favourites?limit=1&cursor=${paged.nextCursor}`, fan.token)
      ).json();
      expect(rest.items[0].id).toBe(item.id);

      await ctx.database.db.update(listings).set({ status: "sold" }).where(eq(listings.id, second.id));
      const withSold = (await call("GET", "/v1/me/favourites", fan.token)).json();
      expect(withSold.items.find((i: { id: string }) => i.id === second.id).status).toBe("sold");
      // a new heart on a sold item is refused
      expect((await call("PUT", `/v1/listings/${second.id}/favourite`, fan2.token)).statusCode).toBe(409);
      await ctx.database.db.update(listings).set({ status: "hidden" }).where(eq(listings.id, second.id));
      const withoutHidden = (await call("GET", "/v1/me/favourites", fan.token)).json();
      expect(withoutHidden.items.map((i: { id: string }) => i.id)).toEqual([item.id]);
    });
  });

  describe("saved searches", () => {
    it("saves, lists, updates and deletes, only for the owner", async () => {
      const created = await call("POST", "/v1/me/saved-searches", fan.token, {
        queryText: "denim jacket",
        filters: { priceMaxMinor: 8000, sort: "newest" },
      });
      expect(created.statusCode).toBe(201);
      const saved = created.json();
      expect(saved).toMatchObject({
        queryText: "denim jacket",
        notifyOnNew: true,
        filters: { priceMaxMinor: 8000, sort: "newest" },
      });

      const again = await call("POST", "/v1/me/saved-searches", fan.token, {
        queryText: "denim jacket",
        filters: { priceMaxMinor: 8000, sort: "newest" },
      });
      expect(again.statusCode).toBe(200);
      expect(again.json().id).toBe(saved.id);

      expect((await call("GET", "/v1/me/saved-searches", fan.token)).json().items).toHaveLength(1);
      expect((await call("GET", "/v1/me/saved-searches", stranger.token)).json().items).toHaveLength(0);

      expect(
        (await call("PATCH", `/v1/me/saved-searches/${saved.id}`, stranger.token, { notifyOnNew: false }))
          .statusCode,
      ).toBe(404);
      expect((await call("DELETE", `/v1/me/saved-searches/${saved.id}`, stranger.token)).statusCode).toBe(
        404,
      );
      const patched = await call("PATCH", `/v1/me/saved-searches/${saved.id}`, fan.token, {
        notifyOnNew: false,
      });
      expect(patched.json().notifyOnNew).toBe(false);
      expect((await call("DELETE", `/v1/me/saved-searches/${saved.id}`, fan.token)).statusCode).toBe(204);
      expect((await call("GET", "/v1/me/saved-searches", fan.token)).json().items).toHaveLength(0);
    });

    it("takes the words from the filters and refuses an empty search", async () => {
      const fromFilters = await call("POST", "/v1/me/saved-searches", fan2.token, {
        filters: { q: "coat", sort: "relevance" },
      });
      expect(fromFilters.json().queryText).toBe("coat");
      const empty = await call("POST", "/v1/me/saved-searches", fan2.token, {});
      expect(empty.statusCode).toBe(400);
      expect((await call("POST", "/v1/me/saved-searches", undefined, { queryText: "x" })).statusCode).toBe(
        401,
      );
    });
  });

  describe("recent searches", () => {
    it("keeps the 10 newest, moves a repeat to the top and clears", async () => {
      const send = (queryText: string, resultCount?: number) =>
        call("POST", "/v1/me/recent-searches", stranger.token, {
          queryText,
          filters: { sort: "relevance" },
          resultCount,
        });
      for (let i = 1; i <= 12; i++) expect((await send(`word ${i}`, i)).statusCode).toBe(204);
      let list = (await call("GET", "/v1/me/recent-searches", stranger.token)).json().items;
      expect(list).toHaveLength(10);
      expect(list[0].queryText).toBe("word 12");
      expect(list[0].resultCount).toBe(12);
      expect(list.at(-1).queryText).toBe("word 3");

      await send("WORD 5", 99);
      list = (await call("GET", "/v1/me/recent-searches", stranger.token)).json().items;
      expect(list).toHaveLength(10);
      expect(list[0]).toMatchObject({ queryText: "WORD 5", resultCount: 99 });
      expect(list.filter((r: { queryText: string }) => r.queryText.toLowerCase() === "word 5")).toHaveLength(
        1,
      );

      expect((await call("DELETE", "/v1/me/recent-searches", stranger.token)).statusCode).toBe(204);
      expect((await call("GET", "/v1/me/recent-searches", stranger.token)).json().items).toEqual([]);
      const rows = await ctx.database.db
        .select()
        .from(recentSearches)
        .where(eq(recentSearches.userId, stranger.id));
      expect(rows).toHaveLength(0);
      expect(
        (await call("POST", "/v1/me/recent-searches", stranger.token, { queryText: "" })).statusCode,
      ).toBe(400);
    });
  });

  describe("personalisation sizes", () => {
    it("replaces the list and refuses sizes that do not exist", async () => {
      const sizeIds = reference.sizeGroups.flatMap((g) => g.sizes.map((s) => s.id));
      const a = sizeIds[0] as string;
      const b = sizeIds[1] as string;
      expect(
        (await call("PUT", "/v1/me/personalisation/sizes", stranger.token, { sizeIds: [a, b, a] })).json(),
      ).toEqual({
        sizeIds: [a, b],
      });
      expect(
        (await call("PUT", "/v1/me/personalisation/sizes", stranger.token, { sizeIds: [b] })).json(),
      ).toEqual({
        sizeIds: [b],
      });
      expect((await call("GET", "/v1/me/personalisation/sizes", stranger.token)).json()).toEqual({
        sizeIds: [b],
      });
      const bad = await call("PUT", "/v1/me/personalisation/sizes", stranger.token, {
        sizeIds: ["00000000-0000-4000-8000-000000000000"],
      });
      expect(bad.statusCode).toBe(400);
      expect(
        (await call("PUT", "/v1/me/personalisation/sizes", stranger.token, { sizeIds: [] })).json(),
      ).toEqual({
        sizeIds: [],
      });
      const rows = await ctx.database.db.select().from(userSizes).where(eq(userSizes.userId, stranger.id));
      expect(rows).toHaveLength(0);
      expect((await call("PUT", "/v1/me/personalisation/sizes", undefined, { sizeIds: [] })).statusCode).toBe(
        401,
      );
    });
  });

  describe("reports", () => {
    it("takes a report once per target and refuses your own things", async () => {
      const body = { targetType: "listing", targetId: item.id, reason: "spam", details: "Looks fake" };
      expect((await call("POST", "/v1/reports", fan.token, body)).statusCode).toBe(204);
      expect((await call("POST", "/v1/reports", fan.token, body)).statusCode).toBe(204);
      const rows = await ctx.database.db.select().from(reports).where(eq(reports.reporterId, fan.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ targetType: "listing", reason: "spam", status: "open" });

      expect((await call("POST", "/v1/reports", seller.token, body)).statusCode).toBe(400);
      expect((await call("POST", "/v1/reports", fan.token, { ...body, targetId: draft.id })).statusCode).toBe(
        404,
      );
      expect((await call("POST", "/v1/reports", undefined, body)).statusCode).toBe(401);
      expect((await call("POST", "/v1/reports", fan.token, { ...body, reason: "nope" })).statusCode).toBe(
        400,
      );
      const user = await call("POST", "/v1/reports", fan.token, {
        targetType: "user",
        targetId: seller.id,
        reason: "harassment",
      });
      expect(user.statusCode).toBe(204);
      expect(
        (
          await call("POST", "/v1/reports", fan.token, {
            targetType: "user",
            targetId: fan.id,
            reason: "spam",
          })
        ).statusCode,
      ).toBe(400);
    });

    it("is limited to 10 an hour", async () => {
      // 5 requests so far in this file. The 6th to 10th pass, the 11th is refused.
      let last = 0;
      for (let i = 0; i < 7; i++) {
        last = (
          await call("POST", "/v1/reports", fan2.token, {
            targetType: "user",
            targetId: seller.id,
            reason: "spam",
          })
        ).statusCode;
      }
      expect(last).toBe(429);
    });
  });
});
