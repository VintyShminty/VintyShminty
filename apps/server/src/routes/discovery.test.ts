import { blocks, favourites, follows, listings, listingViews, profiles } from "@vinty/db";
import { type CategoryNode, categoryTrail, type ReferenceData } from "@vinty/shared";
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
describe.skipIf(!databaseUrl)("discovery", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  let reference: ReferenceData;
  let sized: CategoryNode;
  let brandId: string;
  let otherBrandId: string;
  const stamp = Date.now().toString(36);
  const word = `zqx${stamp}`;

  type Person = { token: string; id: string; username: string };
  let alice: Person;
  let bob: Person; // on holiday
  let carol: Person; // plain viewer
  let dave: Person; // blocks alice
  let erin: Person; // alice blocks her

  let dress: { id: string };
  let coat: { id: string };
  let bobItem: { id: string };
  let draft: { id: string };

  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));

  let photoCounter = 0;
  const photo = (userId: string) => {
    photoCounter += 1;
    return { key: `listings/${userId}/disc-${stamp}-${photoCounter}.jpg`, width: 900, height: 1200 };
  };

  async function publish(owner: Person, over: Record<string, unknown> = {}, publishNow = true) {
    const group = reference.sizeGroups.find((g) => sized.sizeGroupIds.includes(g.id));
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/listings",
      headers: bearer(owner.token),
      payload: {
        title: `${word} linen dress`,
        description: "Worn twice",
        categoryId: sized.id,
        brandId,
        sizeId: group?.sizes[0]?.id,
        conditionId: reference.conditions[0]?.id,
        colourIds: [reference.colours[0]?.id],
        priceMinor: 12000,
        parcelSizeId: reference.parcelSizes[0]?.id,
        photos: [photo(owner.id), photo(owner.id)],
        publish: publishNow,
        ...over,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json() as { id: string };
  }

  const get = (url: string, token?: string) =>
    ctx.app.inject({ method: "GET", url, headers: token ? bearer(token) : {} });
  const ids = (res: { json: () => { items: { id: string }[] } }) => res.json().items.map((i) => i.id);

  beforeAll(async () => {
    ctx = await buildTestApp();
    reference = (await get("/v1/reference")).json();
    sized = leaves(reference.categories).find(
      (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
    ) as CategoryNode;
    const brandsRes = (await get("/v1/brands?limit=2")).json();
    brandId = brandsRes.items[0].id;
    otherBrandId = brandsRes.items[1].id;
    [alice, bob, carol, dave, erin] = (await Promise.all(
      ["alice", "bob", "carol", "dave", "erin"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as Person[];

    dress = await publish(alice);
    coat = await publish(alice, { title: `${word} wool coat`, priceMinor: 30000, brandId: otherBrandId });
    draft = await publish(alice, { title: `${word} draft thing` }, false);
    bobItem = await publish(bob, { title: `${word} holiday jacket`, priceMinor: 5000 });
    await ctx.database.db
      .update(profiles)
      .set({ holidayModeEnabled: true })
      .where(eq(profiles.userId, bob.id));
    await ctx.database.db.insert(blocks).values([
      { blockerId: dave.id, blockedId: alice.id },
      { blockerId: alice.id, blockedId: erin.id },
    ]);
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("search", () => {
    it("finds listings by word, hides drafts and holiday sellers, and counts them", async () => {
      const res = await get(`/v1/listings?q=${word}`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items.map((i: { id: string }) => i.id).sort()).toEqual([dress.id, coat.id].sort());
      expect(body.total).toBe(2);
      expect(body.totalCapped).toBe(false);
      expect(body.items[0].seller.username).toBe(alice.username);
      expect(body.items[0].isFavourited).toBeUndefined();
      expect(body.items[0].sizeLabel).toBeTruthy();
      expect(body.items[0].conditionSlug).toBeTruthy();
    });

    it("matches the start of a word and a piece in the middle", async () => {
      expect(ids(await get(`/v1/listings?q=${word}%20lin`))).toEqual([dress.id]);
      expect(ids(await get(`/v1/listings?q=${word}%20ool`))).toEqual([coat.id]);
    });

    it("does not crash on Hebrew, punctuation or odd text", async () => {
      for (const q of ["שמלה", "שמלה כחולה!", "100%", "a & b | (c)", "'; drop table", "x:*", "\\"]) {
        const res = await get(`/v1/listings?q=${encodeURIComponent(q)}`);
        expect(res.statusCode, q).toBe(200);
      }
    });

    it("sorts by price and newest, and pages with a cursor", async () => {
      const asc = await get(`/v1/listings?q=${word}&sort=price_asc`);
      expect(ids(asc)).toEqual([dress.id, coat.id]);
      const desc = await get(`/v1/listings?q=${word}&sort=price_desc`);
      expect(ids(desc)).toEqual([coat.id, dress.id]);
      const newest = await get(`/v1/listings?q=${word}&sort=newest`);
      expect(ids(newest)).toEqual([coat.id, dress.id]);

      for (const sort of ["price_asc", "price_desc", "newest", "relevance"]) {
        const first = (await get(`/v1/listings?q=${word}&sort=${sort}&limit=1`)).json();
        expect(first.items).toHaveLength(1);
        expect(first.nextCursor).toBeTruthy();
        expect(first.total).toBe(2);
        const second = (
          await get(`/v1/listings?q=${word}&sort=${sort}&limit=1&cursor=${first.nextCursor}`)
        ).json();
        expect(second.items).toHaveLength(1);
        expect(second.items[0].id).not.toBe(first.items[0].id);
        expect(second.nextCursor).toBeNull();
      }
    });

    it("ranks a title hit above a recency-only match", async () => {
      const res = await get(`/v1/listings?q=${word}%20coat&sort=relevance`);
      expect(ids(res)[0]).toBe(coat.id);
    });

    it("applies the filters", async () => {
      const base = `/v1/listings?q=${word}`;
      expect(ids(await get(`${base}&priceMaxMinor=20000`))).toEqual([dress.id]);
      expect(ids(await get(`${base}&priceMinMinor=20000`))).toEqual([coat.id]);
      expect(ids(await get(`${base}&brandIds=${otherBrandId}`))).toEqual([coat.id]);
      expect(ids(await get(`${base}&brandIds=${brandId},${otherBrandId}`))).toHaveLength(2);
      expect(ids(await get(`${base}&brandIds=${brandId}&brandIds=${otherBrandId}`))).toHaveLength(2);
      const top = categoryTrail(reference.categories, sized.id)[0] as CategoryNode;
      expect(ids(await get(`${base}&categoryId=${top.id}`))).toHaveLength(2);
      expect(ids(await get(`${base}&categoryId=${sized.id}`))).toHaveLength(2);
      const colour = reference.colours[0]?.id;
      expect(ids(await get(`${base}&colourIds=${colour}`))).toHaveLength(2);
      const otherColour = reference.colours[1]?.id;
      expect(ids(await get(`${base}&colourIds=${otherColour}`))).toHaveLength(0);
      expect(ids(await get(`${base}&sellerId=${alice.id}`))).toHaveLength(2);
      expect(ids(await get(`${base}&sellerId=${carol.id}`))).toHaveLength(0);
      const detail = (await get(`/v1/listings/${dress.id}`)).json();
      expect(ids(await get(`${base}&sizeIds=${detail.size.id}`))).toContain(dress.id);
      expect(ids(await get(`${base}&conditionIds=${detail.condition.id}`))).toHaveLength(2);
    });

    it("searches several categories at once with categoryIds", async () => {
      const base = `/v1/listings?q=${word}`;
      const other = leaves(reference.categories).find((c) => c.id !== sized.id) as CategoryNode;
      expect(ids(await get(`${base}&categoryIds=${sized.id},${other.id}`))).toHaveLength(2);
      expect(ids(await get(`${base}&categoryIds=${sized.id}&categoryIds=${other.id}`))).toHaveLength(2);
      expect(ids(await get(`${base}&categoryIds=${other.id}`))).toHaveLength(0);
      const top = categoryTrail(reference.categories, sized.id)[0] as CategoryNode;
      expect(ids(await get(`${base}&categoryIds=${top.id}`))).toHaveLength(2);
      expect((await get(`${base}&categoryIds=nope`)).statusCode).toBe(400);
      const count = (await get(`/v1/listings/count?q=${word}&categoryIds=${sized.id}`)).json();
      expect(count.total).toBe(2);
    });

    it("rejects a bad filter with 400", async () => {
      expect((await get("/v1/listings?categoryId=nope")).statusCode).toBe(400);
      expect((await get("/v1/listings?sort=weird")).statusCode).toBe(400);
      expect((await get("/v1/listings?limit=500")).statusCode).toBe(400);
    });

    it("leaves out holiday sellers, but their profile page still lists them", async () => {
      expect(ids(await get(`/v1/listings?q=holiday&sellerId=${bob.id}`))).toEqual([]);
      const profile = (await get(`/v1/users/${bob.id}/listings`)).json();
      expect(profile.items.map((i: { id: string }) => i.id)).toEqual([bobItem.id]);
      const detail = await get(`/v1/listings/${bobItem.id}`);
      expect(detail.statusCode).toBe(200);
      expect(detail.json().sellerOnHoliday).toBe(true);
      expect(detail.json().viewer.canBuy).toBe(false);
    });

    it("leaves out blocked people in both directions", async () => {
      // dave blocked alice
      expect(ids(await get(`/v1/listings?q=${word}`, dave.token))).toEqual([]);
      // alice blocked erin
      expect(ids(await get(`/v1/listings?q=${word}`, erin.token))).toEqual([]);
      expect((await get(`/v1/listings/${dress.id}`, dave.token)).statusCode).toBe(404);
      expect((await get(`/v1/listings/${dress.id}`, erin.token)).statusCode).toBe(404);
      expect(ids(await get(`/v1/listings?q=${word}`, carol.token))).toHaveLength(2);
    });

    it("counts without loading cards", async () => {
      const res = await get(`/v1/listings/count?q=${word}&priceMaxMinor=20000`);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ total: 1, totalCapped: false });
    });

    it("marks hearted cards for a signed in viewer", async () => {
      await ctx.database.db.insert(favourites).values({ userId: carol.id, listingId: coat.id });
      const res = (await get(`/v1/listings?q=${word}&sort=price_desc`, carol.token)).json();
      expect(res.items.map((i: { isFavourited: boolean }) => i.isFavourited)).toEqual([true, false]);
      await ctx.database.db.delete(favourites).where(eq(favourites.userId, carol.id));
    });
  });

  describe("suggestions", () => {
    it("offers brands and categories that start with the typed text", async () => {
      const brandName = (await get("/v1/brands?limit=1")).json().items[0].name as string;
      const res = await get(`/v1/search/suggestions?q=${encodeURIComponent(brandName.slice(0, 3))}`);
      expect(res.statusCode).toBe(200);
      const { suggestions } = res.json();
      expect(suggestions.length).toBeLessThanOrEqual(10);
      expect(
        suggestions.some((s: { kind: string; text: string }) => s.kind === "brand" && s.text === brandName),
      ).toBe(true);

      const category = leaves(reference.categories)[0] as CategoryNode;
      const byCategory = (
        await get(`/v1/search/suggestions?q=${encodeURIComponent(category.name.en.slice(0, 4))}`)
      ).json();
      expect(byCategory.suggestions.some((s: { categoryId?: string }) => s.categoryId === category.id)).toBe(
        true,
      );
    });

    it("needs some text", async () => {
      expect((await get("/v1/search/suggestions?q=")).statusCode).toBe(400);
      expect((await get("/v1/search/suggestions?q=שמ")).statusCode).toBe(200);
    });
  });

  describe("item page", () => {
    it("opens for anyone with a viewer block, and reserved and sold stay open", async () => {
      const anon = await get(`/v1/listings/${coat.id}`);
      expect(anon.statusCode).toBe(200);
      expect(anon.json().viewer).toMatchObject({ isOwner: false, isFavourited: false, canBuy: true });
      expect(anon.json().sellerOnHoliday).toBe(false);
      const owner = await get(`/v1/listings/${coat.id}`, alice.token);
      expect(owner.json().viewer).toMatchObject({ isOwner: true, canBuy: false, canOffer: false });

      await ctx.database.db.update(listings).set({ status: "reserved" }).where(eq(listings.id, coat.id));
      const reserved = await get(`/v1/listings/${coat.id}`, carol.token);
      expect(reserved.statusCode).toBe(200);
      expect(reserved.json().status).toBe("reserved");
      expect(reserved.json().viewer.canBuy).toBe(false);
      await ctx.database.db.update(listings).set({ status: "sold" }).where(eq(listings.id, coat.id));
      expect((await get(`/v1/listings/${coat.id}`)).json().status).toBe("sold");
      await ctx.database.db.update(listings).set({ status: "active" }).where(eq(listings.id, coat.id));
    });

    it("keeps drafts and hidden listings for the owner and answers 404 to others", async () => {
      expect((await get(`/v1/listings/${draft.id}`)).statusCode).toBe(404);
      expect((await get(`/v1/listings/${draft.id}`, carol.token)).statusCode).toBe(404);
      const own = await get(`/v1/listings/${draft.id}`, alice.token);
      expect(own.statusCode).toBe(200);
      expect(own.json().status).toBe("draft");

      await ctx.database.db.update(listings).set({ status: "hidden" }).where(eq(listings.id, dress.id));
      expect((await get(`/v1/listings/${dress.id}`, carol.token)).statusCode).toBe(404);
      expect((await get(`/v1/listings/${dress.id}`, alice.token)).statusCode).toBe(200);
      await ctx.database.db.update(listings).set({ status: "removed" }).where(eq(listings.id, dress.id));
      expect((await get(`/v1/listings/${dress.id}`, alice.token)).statusCode).toBe(404);
      await ctx.database.db.update(listings).set({ status: "active" }).where(eq(listings.id, dress.id));
      expect((await get("/v1/listings/00000000-0000-4000-8000-000000000000")).statusCode).toBe(404);
      expect((await get("/v1/listings/not-an-id")).statusCode).toBe(400);
    });

    it("counts a view once per viewer per day and ignores the owner", async () => {
      const viewed = await publish(alice, { title: `${word} viewed once` });
      const read = async () =>
        (
          await ctx.database.db
            .select({ n: listings.viewCount, u: listings.updatedAt })
            .from(listings)
            .where(eq(listings.id, viewed.id))
        )[0] as { n: number; u: Date };
      const before = await read();
      await get(`/v1/listings/${viewed.id}`, alice.token);
      expect((await read()).n).toBe(before.n);

      const first = await get(`/v1/listings/${viewed.id}`, carol.token);
      expect(first.json().viewCount).toBe(before.n + 1);
      await get(`/v1/listings/${viewed.id}`, carol.token);
      const again = await get(`/v1/listings/${viewed.id}`, carol.token);
      expect(again.json().viewCount).toBe(before.n + 1);
      expect((await read()).n).toBe(before.n + 1);
      expect((await read()).u.getTime()).toBe(before.u.getTime());

      // A visitor counts once, and another day counts again.
      await get(`/v1/listings/${viewed.id}`);
      await get(`/v1/listings/${viewed.id}`);
      expect((await read()).n).toBe(before.n + 2);
      await ctx.database.db
        .update(listingViews)
        .set({ day: "2020-01-01" })
        .where(and(eq(listingViews.listingId, viewed.id), eq(listingViews.viewerKey, `u:${carol.id}`)));
      await get(`/v1/listings/${viewed.id}`, carol.token);
      expect((await read()).n).toBe(before.n + 3);
    });

    it("shows similar items without the item itself", async () => {
      const res = await get(`/v1/listings/${dress.id}/similar?limit=10`, carol.token);
      expect(res.statusCode).toBe(200);
      const found = ids(res);
      expect(found).not.toContain(dress.id);
      expect(found).toContain(coat.id);
      expect(found).not.toContain(bobItem.id);
      expect((await get(`/v1/listings/${draft.id}/similar`, carol.token)).statusCode).toBe(404);
    });
  });

  describe("members and profile listings", () => {
    it("finds people by the start of the username", async () => {
      const res = await get(`/v1/users?q=${alice.username.slice(0, 12).toUpperCase()}`);
      expect(res.statusCode).toBe(200);
      expect(ids(res)).toContain(alice.id);
      expect((await get(`/v1/users?q=${bob.username}`)).json().items[0].username).toBe(bob.username);
      expect(ids(await get(`/v1/users?q=${alice.username}`, dave.token))).not.toContain(alice.id);
      expect(ids(await get("/v1/users?q=no_such_member_zzz"))).toEqual([]);
      expect((await get("/v1/users")).statusCode).toBe(400);
    });

    it("lists a profile with the status chip and filters", async () => {
      const active = await get(`/v1/users/${alice.id}/listings?q=coat`);
      expect(ids(active)).toEqual([coat.id]);
      expect(active.json().items[0].sizeLabel).toBeTruthy();
      expect(ids(await get(`/v1/users/${alice.id}/listings?status=sold`))).toEqual([]);
      await ctx.database.db.update(listings).set({ status: "sold" }).where(eq(listings.id, coat.id));
      expect(ids(await get(`/v1/users/${alice.id}/listings?status=sold`))).toEqual([coat.id]);
      await ctx.database.db.update(listings).set({ status: "active" }).where(eq(listings.id, coat.id));
      const priciest = ids(await get(`/v1/users/${alice.id}/listings?sort=price_desc`));
      expect(priciest[0]).toBe(coat.id);
      expect(priciest).toContain(dress.id);
      const cheap = ids(await get(`/v1/users/${alice.id}/listings?priceMaxMinor=20000`));
      expect(cheap).toContain(dress.id);
      expect(cheap).not.toContain(coat.id);
    });
  });

  describe("feed", () => {
    it("is newest first for visitors and carries the chips", async () => {
      const fresh = await publish(alice, { title: `${word} fresh arrival` });
      const feed = await get("/v1/feed?limit=5");
      expect(feed.statusCode).toBe(200);
      expect(ids(feed)).toContain(fresh.id);
      expect(feed.json().items[0].isFavourited).toBeUndefined();
      expect(ids(feed)).not.toContain(bobItem.id);

      const chip = await get(
        `/v1/feed?categoryId=${categoryTrail(reference.categories, sized.id)[0]?.id}&limit=50`,
      );
      expect(ids(chip)).toContain(fresh.id);
      const trending = await get("/v1/feed?trending=true&limit=5");
      expect(trending.statusCode).toBe(200);
      expect(trending.json().items.length).toBeGreaterThan(0);

      const paged = (await get("/v1/feed?limit=3")).json();
      const next = (await get(`/v1/feed?limit=3&cursor=${paged.nextCursor}`)).json();
      const seen = new Set(paged.items.map((i: { id: string }) => i.id));
      for (const item of next.items) expect(seen.has(item.id)).toBe(false);
      await ctx.database.db.delete(listings).where(eq(listings.id, fresh.id));
    });

    describe("mood chips", () => {
      it("for_you is the normal feed", async () => {
        const plain = ids(await get("/v1/feed?limit=50"));
        expect(ids(await get("/v1/feed?mood=for_you&limit=50"))).toEqual(plain);
        expect((await get("/v1/feed?mood=weird")).statusCode).toBe(400);
      });

      it("new_today keeps only what was listed in the last 24 hours", async () => {
        const old = await publish(alice, { title: `${word} last week piece` });
        await ctx.database.db
          .update(listings)
          .set({ publishedAt: new Date(Date.now() - 48 * 3_600_000) })
          .where(eq(listings.id, old.id));
        const fresh = await publish(alice, { title: `${word} today piece` });
        const res = await get("/v1/feed?mood=new_today&limit=50");
        expect(ids(res)).toContain(fresh.id);
        expect(ids(res)).not.toContain(old.id);
        await ctx.database.db.delete(listings).where(eq(listings.id, old.id));
        await ctx.database.db.delete(listings).where(eq(listings.id, fresh.id));
      });

      it("under_50 means below 50.00 in shekels", async () => {
        const cheap = await publish(alice, { title: `${word} cheap piece`, priceMinor: 4900 });
        const edge = await publish(alice, { title: `${word} edge piece`, priceMinor: 5000 });
        const res = await get("/v1/feed?mood=under_50&limit=50");
        expect(ids(res)).toContain(cheap.id);
        expect(ids(res)).not.toContain(edge.id);
        for (const item of res.json().items) {
          expect(item.currency).toBe("ILS");
          expect(item.priceMinor).toBeLessThan(5000);
        }
        await ctx.database.db.delete(listings).where(eq(listings.id, cheap.id));
        await ctx.database.db.delete(listings).where(eq(listings.id, edge.id));
      });

      it("your_sizes uses the viewer's sizes and is empty without any", async () => {
        const detail = (await get(`/v1/listings/${dress.id}`)).json();
        expect((await get("/v1/feed?mood=your_sizes&limit=50")).json().items).toEqual([]);
        const none = await get("/v1/feed?mood=your_sizes&limit=50", carol.token);
        expect(none.json().items).toEqual([]);
        const put = await ctx.app.inject({
          method: "PUT",
          url: "/v1/me/personalisation/sizes",
          headers: bearer(carol.token),
          payload: { sizeIds: [detail.size.id] },
        });
        expect(put.statusCode, put.body).toBe(200);
        const res = await get("/v1/feed?mood=your_sizes&limit=50", carol.token);
        expect(ids(res)).toContain(dress.id);
        for (const item of res.json().items) expect(item.sizeLabel).toBe(detail.size.label);
        await ctx.app.inject({
          method: "PUT",
          url: "/v1/me/personalisation/sizes",
          headers: bearer(carol.token),
          payload: { sizeIds: [] },
        });
      });

      it("near_you matches the viewer's city and is empty without one", async () => {
        const db = ctx.database.db;
        await db.update(listings).set({ city: "Haifa" }).where(eq(listings.id, dress.id));
        await db.update(listings).set({ city: "Eilat" }).where(eq(listings.id, coat.id));
        expect((await get("/v1/feed?mood=near_you&limit=50")).json().items).toEqual([]);
        await db.update(profiles).set({ city: null }).where(eq(profiles.userId, carol.id));
        expect((await get("/v1/feed?mood=near_you&limit=50", carol.token)).json().items).toEqual([]);
        await db.update(profiles).set({ city: " haifa " }).where(eq(profiles.userId, carol.id));
        const res = await get("/v1/feed?mood=near_you&limit=50", carol.token);
        expect(ids(res)).toContain(dress.id);
        expect(ids(res)).not.toContain(coat.id);
        await db.update(profiles).set({ city: null }).where(eq(profiles.userId, carol.id));
      });
    });

    it("leaves out your own items for a signed in person", async () => {
      const feed = await get("/v1/feed?limit=50", alice.token);
      expect(ids(feed)).not.toContain(dress.id);
      expect(feed.json().items[0].isFavourited).toBe(false);
    });

    it("lifts sellers a person follows", async () => {
      const seller = await signUpTestUser(ctx, "followed", createdIds);
      const older = await publish(seller, { title: `${word} older follow item` });
      await ctx.database.db
        .update(listings)
        .set({ bumpedAt: new Date(Date.now() - 3 * 3_600_000) })
        .where(eq(listings.id, older.id));
      const newer = await publish(alice, { title: `${word} newer other item` });

      const anon = ids(await get("/v1/feed?limit=50"));
      expect(anon.indexOf(newer.id)).toBeLessThan(anon.indexOf(older.id));

      await ctx.database.db.insert(follows).values({ followerId: carol.id, followeeId: seller.id });
      const mine = ids(await get("/v1/feed?limit=50", carol.token));
      expect(mine.indexOf(older.id)).toBeGreaterThanOrEqual(0);
      expect(mine.indexOf(older.id)).toBeLessThan(mine.indexOf(newer.id));
      await ctx.database.db.delete(follows).where(eq(follows.followerId, carol.id));
      await ctx.database.db.delete(listings).where(eq(listings.id, newer.id));
    });
  });
});
