import {
  feedSnapshots,
  listingPopularity7d,
  listings,
  userAffinities,
  userEvents,
  userSettings,
  users,
} from "@vinty/db";
import { type CategoryNode, EVENTS_PER_MINUTE, type ReferenceData } from "@vinty/shared";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { homeFeedPage } from "../lib/feed.js";
import { cleanupFeedData, refreshPopularity } from "../lib/feed-jobs.js";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  newPerson,
  signUpTestUser,
  type TestContext,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("home feed learning", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  let reference: ReferenceData;
  let sized: CategoryNode;
  let brandA: string;
  let brandB: string;
  const stamp = Date.now().toString(36);
  const word = `fdq${stamp}`;

  type Person = { token: string; id: string; username: string };
  let sellers: Person[];
  let itemsA: { id: string; sellerId: string }[];
  let itemsB: { id: string; sellerId: string }[];

  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));
  let photoCounter = 0;

  async function publish(owner: Person, over: Record<string, unknown> = {}) {
    photoCounter += 1;
    const group = reference.sizeGroups.find((g) => sized.sizeGroupIds.includes(g.id));
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/listings",
      headers: bearer(owner.token),
      payload: {
        title: `${word} dress ${photoCounter}`,
        description: "Worn twice",
        categoryId: sized.id,
        brandId: brandA,
        sizeId: group?.sizes[0]?.id,
        conditionId: reference.conditions[0]?.id,
        colourIds: [reference.colours[0]?.id],
        priceMinor: 12000,
        parcelSizeId: reference.parcelSizes[0]?.id,
        photos: [
          { key: `listings/${owner.id}/fd-${stamp}-${photoCounter}.jpg`, width: 900, height: 1200 },
          { key: `listings/${owner.id}/fd-${stamp}-${photoCounter}b.jpg`, width: 900, height: 1200 },
        ],
        publish: true,
        ...over,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return { id: res.json().id as string, sellerId: owner.id };
  }

  const call = (
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    url: string,
    token?: string,
    payload?: unknown,
  ) =>
    ctx.app.inject({
      method,
      url,
      headers: {
        ...(token ? bearer(token) : {}),
        ...(payload !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
  const uuid = () => crypto.randomUUID();
  const feed = async (token: string | undefined, query = "limit=20") =>
    (await call("GET", `/v1/feed?${query}`, token)).json() as {
      items: { id: string; reason: { kind: string; name: unknown } | null }[];
      nextCursor: string | null;
      feedId: string | null;
    };
  const eventRows = (userId: string, type?: string) =>
    ctx.database.db
      .select()
      .from(userEvents)
      .where(
        type
          ? and(eq(userEvents.userId, userId), sql`${userEvents.type} = ${type}`)
          : eq(userEvents.userId, userId),
      );
  const affinityRows = (userId: string) =>
    ctx.database.db.select().from(userAffinities).where(eq(userAffinities.userId, userId));
  const newPersonWith = async (label: string) => signUpTestUser(ctx, label, createdIds);

  beforeAll(async () => {
    ctx = await buildTestApp({ CRON_SECRET: "test-cron-secret-0123456789" });
    reference = (await call("GET", "/v1/reference")).json();
    sized = leaves(reference.categories).find(
      (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
    ) as CategoryNode;
    const brandsRes = (await call("GET", "/v1/brands?limit=2")).json();
    brandA = brandsRes.items[0].id;
    brandB = brandsRes.items[1].id;
    sellers = await Promise.all(["s1", "s2", "s3", "s4"].map((n) => newPersonWith(n)));
    itemsA = await Promise.all(sellers.map((s) => publish(s, { brandId: brandA })));
    itemsB = await Promise.all(sellers.map((s) => publish(s, { brandId: brandB })));
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("recording what the server sees", () => {
    it("records a heart, a repeat open and a removed heart, and fades the taste", async () => {
      const p = await newPersonWith("rec");
      const target = itemsA[0] as { id: string };
      expect((await call("PUT", `/v1/listings/${target.id}/favourite`, p.token)).statusCode).toBe(200);
      const hearts = await eventRows(p.id, "favourite");
      expect(hearts).toHaveLength(1);
      expect(hearts[0]?.brandId).toBe(brandA);
      expect(hearts[0]?.categoryId).toBe(sized.id);
      expect(hearts[0]?.priceBand).toBe(2);
      const brand = (await affinityRows(p.id)).find((a) => a.feature === "brand" && a.featureKey === brandA);
      expect(brand?.score).toBeCloseTo(3.2, 1);
      const category = (await affinityRows(p.id)).find((a) => a.feature === "category");
      expect(category?.score).toBeCloseTo(4, 1);

      // Hearting again changes nothing.
      await call("PUT", `/v1/listings/${target.id}/favourite`, p.token);
      expect(await eventRows(p.id, "favourite")).toHaveLength(1);

      await call("DELETE", `/v1/listings/${target.id}/favourite`, p.token);
      expect(await eventRows(p.id, "unfavourite")).toHaveLength(1);
      const after = (await affinityRows(p.id)).find((a) => a.feature === "category");
      expect(after?.score ?? 0).toBeCloseTo(0, 1);

      // A first open is weight 1, an open on another day is weight 2.
      await call("GET", `/v1/listings/${target.id}`, p.token);
      expect(await eventRows(p.id, "listing_open")).toHaveLength(1);
      await ctx.database.db.execute(
        sql`update listing_views set day = (current_date - 2) where viewer_key = ${`u:${p.id}`} and listing_id = ${target.id}`,
      );
      await call("GET", `/v1/listings/${target.id}`, p.token);
      expect(await eventRows(p.id, "listing_open_repeat")).toHaveLength(1);
    });

    it("records a search, a saved search, a first message, an offer and a purchase", async () => {
      const p = await newPersonWith("rec2");
      await call("POST", "/v1/me/recent-searches", p.token, {
        queryText: "midi dress",
        filters: { sort: "relevance", categoryId: sized.id, brandIds: [brandA] },
      });
      const searches = await eventRows(p.id, "search");
      expect(searches).toHaveLength(1);
      expect(searches[0]?.brandId).toBe(brandA);

      await call("POST", "/v1/me/saved-searches", p.token, {
        queryText: "midi dress",
        filters: { sort: "relevance", categoryId: sized.id },
      });
      expect(await eventRows(p.id, "save_search")).toHaveLength(1);

      const target = itemsB[1] as { id: string };
      const chat = await call("POST", "/v1/conversations", p.token, {
        listingId: target.id,
        body: "Is it available?",
      });
      expect(chat.statusCode, chat.body).toBe(201);
      expect(await eventRows(p.id, "message_seller")).toHaveLength(1);
      // A second message in the same chat says nothing new.
      await call("POST", `/v1/conversations/${chat.json().id}/messages`, p.token, {
        kind: "text",
        body: "Hello again",
        clientMessageId: uuid(),
      });
      expect(await eventRows(p.id, "message_seller")).toHaveLength(1);

      const offer = await call("POST", `/v1/conversations/${chat.json().id}/offers`, p.token, {
        amountMinor: 10000,
      });
      expect(offer.statusCode, offer.body).toBe(201);
      expect(await eventRows(p.id, "offer")).toHaveLength(1);
    });

    it("does not learn from a person's own listing", async () => {
      const own = itemsA[2] as { id: string };
      const owner = sellers[2] as Person;
      await call("GET", `/v1/listings/${own.id}`, owner.token);
      expect(await eventRows(owner.id)).toHaveLength(0);
    });
  });

  describe("POST /v1/events", () => {
    it("needs a signed in person", async () => {
      const res = await call("POST", "/v1/events", undefined, {
        events: [{ clientEventId: uuid(), type: "impression", listingId: itemsA[0]?.id }],
      });
      expect(res.statusCode).toBe(401);
    });

    it("stores card seen, time on item and category visits, and ignores a resent batch", async () => {
      const p = await newPersonWith("batch");
      const feedId = uuid();
      const batch = {
        events: [
          {
            clientEventId: uuid(),
            type: "impression",
            listingId: itemsA[0]?.id,
            surface: "home",
            position: 3,
            feedId,
          },
          {
            clientEventId: uuid(),
            type: "listing_dwell",
            listingId: itemsA[0]?.id,
            data: { dwellMs: 12000 },
          },
          {
            clientEventId: uuid(),
            type: "listing_dwell",
            listingId: itemsA[1]?.id,
            data: { dwellMs: 2000, photosSwiped: 1 },
          },
          {
            clientEventId: uuid(),
            type: "listing_dwell",
            listingId: itemsA[1]?.id,
            data: { dwellMs: 1000, photosSwiped: 4 },
          },
          { clientEventId: uuid(), type: "category_visit", categoryId: sized.id },
          { clientEventId: uuid(), type: "category_visit", categoryId: uuid() },
          { clientEventId: uuid(), type: "impression", listingId: uuid() },
        ],
      };
      const first = await call("POST", "/v1/events", p.token, batch);
      expect(first.statusCode, first.body).toBe(200);
      // The short dwell, the unknown category and the unknown listing are skipped.
      expect(first.json()).toEqual({ recorded: 4, skipped: 3 });
      const rows = await eventRows(p.id);
      expect(rows.map((r) => r.type).sort()).toEqual([
        "category_visit",
        "impression",
        "listing_dwell",
        "listing_dwell",
      ]);
      const impression = rows.find((r) => r.type === "impression");
      expect(impression).toMatchObject({ surface: "home", position: 3, feedId, brandId: brandA });

      const again = await call("POST", "/v1/events", p.token, batch);
      expect(again.json().recorded).toBe(0);
      expect(await eventRows(p.id)).toHaveLength(4);
      // The impression has weight 0, the dwells 1 each, the visit 0.5 on the category.
      const category = (await affinityRows(p.id)).find(
        (a) => a.feature === "category" && a.featureKey === sized.id,
      );
      expect(category?.score).toBeCloseTo(2 + 0.5, 1);
    });

    it("allows 200 actions a minute per person", async () => {
      const p = await newPersonWith("limit");
      const batch = () => ({
        events: Array.from({ length: 50 }, () => ({
          clientEventId: uuid(),
          type: "impression",
          listingId: itemsA[0]?.id,
        })),
      });
      for (let i = 0; i < EVENTS_PER_MINUTE / 50; i++) {
        expect((await call("POST", "/v1/events", p.token, batch())).statusCode).toBe(200);
      }
      const over = await call("POST", "/v1/events", p.token, batch());
      expect(over.statusCode).toBe(429);
      expect(over.json().error.code).toBe("rate_limited");
      // Another person is not affected.
      const other = await newPersonWith("limit2");
      expect((await call("POST", "/v1/events", other.token, batch())).statusCode).toBe(200);
    });

    it("rejects a bad batch", async () => {
      const p = await newPersonWith("bad");
      expect((await call("POST", "/v1/events", p.token, { events: [] })).statusCode).toBe(400);
      expect(
        (
          await call("POST", "/v1/events", p.token, {
            events: [{ clientEventId: "nope", type: "impression" }],
          })
        ).statusCode,
      ).toBe(400);
      // The server records opens and hearts itself, the app cannot send them.
      expect(
        (
          await call("POST", "/v1/events", p.token, {
            events: [{ clientEventId: uuid(), type: "favourite", listingId: itemsA[0]?.id }],
          })
        ).statusCode,
      ).toBe(400);
    });
  });

  describe("personalisation switch", () => {
    it("records nothing while off, clears what was learned and gives the general feed", async () => {
      const p = await newPersonWith("off");
      await call("PUT", `/v1/listings/${itemsA[0]?.id}/favourite`, p.token);
      expect((await affinityRows(p.id)).length).toBeGreaterThan(0);

      const off = await call("PATCH", "/v1/me/settings", p.token, { personaliseFeed: false });
      expect(off.statusCode).toBe(200);
      expect(await affinityRows(p.id)).toHaveLength(0);
      expect(await eventRows(p.id)).toHaveLength(0);

      await call("PUT", `/v1/listings/${itemsA[1]?.id}/favourite`, p.token);
      await call("GET", `/v1/listings/${itemsA[1]?.id}`, p.token);
      const sent = await call("POST", "/v1/events", p.token, {
        events: [{ clientEventId: uuid(), type: "impression", listingId: itemsA[1]?.id }],
      });
      expect(sent.json()).toEqual({ recorded: 0, skipped: 1 });
      expect(await eventRows(p.id)).toHaveLength(0);
      expect(await affinityRows(p.id)).toHaveLength(0);

      const page = await feed(p.token, "limit=50");
      expect(
        page.items.every(
          (i) =>
            !i.reason ||
            !["like_brand", "like_category", "like_seller", "follows_seller"].includes(i.reason.kind),
        ),
      ).toBe(true);
      await ctx.database.db
        .update(userSettings)
        .set({ personaliseFeed: true })
        .where(eq(userSettings.userId, p.id));
    });
  });

  describe("the feed leans to what a person does", () => {
    it("lifts the brand a person hearts and keeps coming back to", async () => {
      const p = await newPersonWith("lean");
      for (const item of itemsA.slice(0, 3)) await call("PUT", `/v1/listings/${item.id}/favourite`, p.token);
      const dwells = itemsA.flatMap((item) =>
        Array.from({ length: 5 }, () => ({
          clientEventId: uuid(),
          type: "listing_dwell",
          listingId: item.id,
          data: { dwellMs: 15000 },
        })),
      );
      for (let i = 0; i < dwells.length; i += 50) {
        await call("POST", "/v1/events", p.token, { events: dwells.slice(i, i + 50) });
      }
      const page = await feed(p.token, "limit=40");
      const index = (id: string) => page.items.findIndex((i) => i.id === id);
      const a = itemsA.map((i) => index(i.id)).filter((n) => n >= 0);
      const b = itemsB.map((i) => index(i.id)).filter((n) => n >= 0);
      // Up to 4 of one brand fit on a page, and the liked brand comes first.
      expect(a.length).toBeGreaterThanOrEqual(3);
      expect(Math.max(...a.slice(0, 3))).toBeLessThan(Math.min(...b, 999));
      const top = page.items.find((i) => itemsA.some((x) => x.id === i.id));
      expect(top?.reason?.kind).toMatch(/like_brand|like_category/);
    });

    it("gives a new person the general feed with no taste reasons", async () => {
      const p = await newPersonWith("fresh");
      const page = await feed(p.token, "limit=50");
      expect(page.items.length).toBeGreaterThan(10);
      expect(page.feedId).toBeTruthy();
      for (const item of page.items) {
        expect(
          item.reason === null || !["like_brand", "like_category", "like_seller"].includes(item.reason.kind),
        ).toBe(true);
      }
      const visitor = await feed(undefined, "limit=50");
      const overlap = page.items.filter((i) => visitor.items.some((v) => v.id === i.id)).length;
      expect(overlap).toBeGreaterThan(page.items.length * 0.6);
    });

    it("leans the sample person Noa towards Zara dresses", async (t) => {
      const [noa] = await ctx.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, "noa_levi"))
        .limit(1);
      if (!noa) return t.skip();
      const zara = (page: { items: { id: string }[] }, ids: Set<string>) =>
        page.items.filter((i) => ids.has(i.id));
      const rows = await ctx.database.db
        .select({ id: listings.id })
        .from(listings)
        .where(
          and(
            eq(listings.brandName, "Zara"),
            eq(listings.status, "active"),
            sql`${listings.categoryId} in (select id from categories where slug like 'women-clothing-dresses%')`,
          ),
        );
      const zaraDresses = new Set(rows.map((r) => r.id));
      const mine = await homeFeedPage(ctx.app, { viewerId: noa.id }, { cursor: undefined, limit: 20 });
      const visitor = await homeFeedPage(ctx.app, { viewerId: undefined }, { cursor: undefined, limit: 20 });
      expect(zara(mine, zaraDresses).length).toBeGreaterThanOrEqual(4);
      expect(zara(mine, zaraDresses).length).toBeGreaterThan(zara(visitor, zaraDresses).length);
      expect(
        mine.items.some((i) => i.reason?.kind === "like_brand" || i.reason?.kind === "like_category"),
      ).toBe(true);
    });
  });

  describe("pages", () => {
    it("never repeat or skip a card, even when a heart in the middle changes the taste", async () => {
      const p = await newPersonWith("pages");
      const seen: string[] = [];
      let cursor: string | null | undefined;
      let feedId: string | null = null;
      for (let page = 0; page < 8; page++) {
        const res = await feed(p.token, `limit=8${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        expect(res.feedId).toBeTruthy();
        if (feedId) expect(res.feedId).toBe(feedId);
        feedId = res.feedId;
        seen.push(...res.items.map((i) => i.id));
        if (page === 1) {
          // A heart on something that is still to come.
          const next = (await feed(p.token, `limit=8&cursor=${encodeURIComponent(res.nextCursor as string)}`))
            .items[0];
          await call("PUT", `/v1/listings/${(itemsA[0] as { id: string }).id}/favourite`, p.token);
          if (next) await call("PUT", `/v1/listings/${next.id}/favourite`, p.token);
        }
        cursor = res.nextCursor;
        if (!cursor) break;
      }
      expect(seen.length).toBeGreaterThan(40);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it("start over with a new list when the person pulls to refresh", async () => {
      const p = await newPersonWith("refresh");
      const one = await feed(p.token);
      const two = await feed(p.token);
      expect(two.feedId).not.toBe(one.feedId);
      const [row] = await ctx.database.db
        .select()
        .from(feedSnapshots)
        .where(eq(feedSnapshots.id, one.feedId as string));
      expect(row?.listingIds.length).toBeGreaterThan(20);
      expect(row?.userId).toBe(p.id);
    });

    it("go on newest first after the saved list and never show a card twice", async () => {
      const p = await newPersonWith("tail");
      const first = await feed(p.token, "limit=50");
      const [snap] = await ctx.database.db
        .select()
        .from(feedSnapshots)
        .where(eq(feedSnapshots.id, first.feedId as string));
      const total = snap?.listingIds.length ?? 0;
      // Cut the saved list short, so the end of it is reached in the test.
      await ctx.database.db
        .update(feedSnapshots)
        .set({
          listingIds: (snap?.listingIds ?? []).slice(0, 10),
          reasons: ((snap?.reasons ?? []) as unknown[]).slice(0, 10),
        })
        .where(eq(feedSnapshots.id, first.feedId as string));
      const seen: string[] = [];
      let cursor: string | null = (await feed(p.token, "limit=5")).nextCursor;
      expect(total).toBeGreaterThan(10);
      // First page needs the cut list: ask again with the cursor of the cut list.
      const cutFirst = await call(
        "GET",
        `/v1/feed?limit=5&cursor=${encodeURIComponent(Buffer.from(JSON.stringify({ f: first.feedId, o: 0 })).toString("base64url"))}`,
        p.token,
      );
      expect(cutFirst.statusCode).toBe(200);
      seen.push(...cutFirst.json().items.map((i: { id: string }) => i.id));
      cursor = cutFirst.json().nextCursor;
      for (let i = 0; i < 12 && cursor; i++) {
        const res = await feed(p.token, `limit=5&cursor=${encodeURIComponent(cursor)}`);
        seen.push(...res.items.map((x) => x.id));
        cursor = res.nextCursor;
      }
      expect(seen.length).toBeGreaterThan(10);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it("keep the moods working on top of the new ranking", async () => {
      const p = await newPersonWith("mood");
      await call("PUT", `/v1/listings/${itemsA[0]?.id}/favourite`, p.token);
      const cheap = await publish(sellers[0] as Person, { priceMinor: 3000, title: `${word} cheap dress` });
      const under = await feed(p.token, "mood=under_50&limit=50");
      expect(under.items.map((i) => i.id)).toContain(cheap.id);
      const full = (await call("GET", "/v1/feed?mood=under_50&limit=50", p.token)).json();
      for (const item of full.items) expect(item.priceMinor).toBeLessThan(5000);
      const today = await feed(p.token, "mood=new_today&limit=50");
      expect(today.items.map((i) => i.id)).toContain(cheap.id);
      const forYou = await feed(p.token, "mood=for_you&limit=20");
      expect(forYou.items.length).toBe(20);
      expect((await call("GET", "/v1/feed?trending=true&limit=5", p.token)).json().feedId).toBeNull();
    });
  });

  describe("Not interested", () => {
    it("hides an item, a seller, a brand and a category, lists them and brings them back", async () => {
      const p = await newPersonWith("hide");
      const inFeed = async () => (await feed(p.token, "limit=50")).items.map((i) => i.id);
      expect(await inFeed()).toContain((itemsA[0] as { id: string }).id);

      const item = await call("POST", "/v1/feed/hide", p.token, { scope: "item", targetId: itemsA[0]?.id });
      expect(item.statusCode, item.body).toBe(201);
      expect(item.json().label).toContain(word);
      expect(await inFeed()).not.toContain((itemsA[0] as { id: string }).id);
      // Hiding twice answers with the same row.
      const twice = await call("POST", "/v1/feed/hide", p.token, { scope: "item", targetId: itemsA[0]?.id });
      expect(twice.statusCode).toBe(200);
      expect(twice.json().id).toBe(item.json().id);
      expect((await eventRows(p.id, "not_interested")).length).toBe(1);

      const seller = await call("POST", "/v1/feed/hide", p.token, {
        scope: "seller",
        targetId: sellers[1]?.id,
      });
      expect(seller.json().label).toBe(sellers[1]?.username);
      const ids = await inFeed();
      expect(ids).not.toContain((itemsA[1] as { id: string }).id);
      expect(ids).not.toContain((itemsB[1] as { id: string }).id);

      const brand = await call("POST", "/v1/feed/hide", p.token, { scope: "brand", targetId: brandB });
      expect(brand.statusCode).toBe(201);
      expect(await inFeed()).not.toContain((itemsB[2] as { id: string }).id);

      const cat = await call("POST", "/v1/feed/hide", p.token, { scope: "category", targetId: sized.id });
      expect(cat.json().categoryName.en).toBeTruthy();
      expect(await inFeed()).not.toContain((itemsA[2] as { id: string }).id);

      const list = await call("GET", "/v1/feed/hidden", p.token);
      expect(
        list
          .json()
          .items.map((i: { scope: string }) => i.scope)
          .sort(),
      ).toEqual(["brand", "category", "item", "seller"]);

      for (const row of list.json().items) {
        expect((await call("DELETE", `/v1/feed/hidden/${row.id}`, p.token)).statusCode).toBe(204);
      }
      expect((await call("GET", "/v1/feed/hidden", p.token)).json().items).toEqual([]);
      expect(await inFeed()).toContain((itemsA[2] as { id: string }).id);
      expect((await call("DELETE", `/v1/feed/hidden/${item.json().id}`, p.token)).statusCode).toBe(404);
    });

    it("keeps one person's hides away from another and refuses bad targets", async () => {
      const a = await newPersonWith("hidea");
      const b = await newPersonWith("hideb");
      const hidden = await call("POST", "/v1/feed/hide", a.token, { scope: "item", targetId: itemsB[3]?.id });
      expect((await call("GET", "/v1/feed/hidden", b.token)).json().items).toEqual([]);
      expect((await call("DELETE", `/v1/feed/hidden/${hidden.json().id}`, b.token)).statusCode).toBe(404);
      expect(
        (await call("POST", "/v1/feed/hide", a.token, { scope: "item", targetId: uuid() })).statusCode,
      ).toBe(404);
      expect(
        (await call("POST", "/v1/feed/hide", a.token, { scope: "seller", targetId: a.id })).statusCode,
      ).toBe(404);
      expect(
        (await call("POST", "/v1/feed/hide", a.token, { scope: "brand", targetId: uuid() })).statusCode,
      ).toBe(404);
      expect(
        (await call("POST", "/v1/feed/hide", undefined, { scope: "item", targetId: itemsB[3]?.id }))
          .statusCode,
      ).toBe(401);
      // The owner cannot hide their own item.
      expect(
        (
          await call("POST", "/v1/feed/hide", (sellers[3] as Person).token, {
            scope: "item",
            targetId: itemsB[3]?.id,
          })
        ).statusCode,
      ).toBe(404);
    });
  });

  describe("reset and closing the account", () => {
    it("reset clears the taste and the diary, and keeps hearts, sizes and hides", async () => {
      const p = await newPersonWith("reset");
      await call("PUT", `/v1/listings/${itemsA[0]?.id}/favourite`, p.token);
      await call("POST", "/v1/feed/hide", p.token, { scope: "item", targetId: itemsB[0]?.id });
      const size = reference.sizeGroups[0]?.sizes[0]?.id as string;
      await call("PUT", "/v1/me/personalisation/sizes", p.token, { sizeIds: [size] });
      await feed(p.token);
      expect((await affinityRows(p.id)).length).toBeGreaterThan(0);

      expect((await call("DELETE", "/v1/me/personalisation", p.token)).statusCode).toBe(204);
      expect(await affinityRows(p.id)).toHaveLength(0);
      expect(await eventRows(p.id)).toHaveLength(0);
      const snaps = await ctx.database.db.select().from(feedSnapshots).where(eq(feedSnapshots.userId, p.id));
      expect(snaps).toHaveLength(0);

      expect(
        (await call("GET", "/v1/me/favourites", p.token)).json().items.map((i: { id: string }) => i.id),
      ).toEqual([(itemsA[0] as { id: string }).id]);
      expect((await call("GET", "/v1/feed/hidden", p.token)).json().items).toHaveLength(1);
      expect((await call("GET", "/v1/me/personalisation/sizes", p.token)).json().sizeIds).toEqual([size]);
      expect((await call("DELETE", "/v1/me/personalisation", undefined)).statusCode).toBe(401);
    });

    it("closing an account deletes everything the feed kept", async () => {
      const p = await newPersonWith("close");
      await call("PUT", `/v1/listings/${itemsA[0]?.id}/favourite`, p.token);
      await call("POST", "/v1/feed/hide", p.token, { scope: "seller", targetId: sellers[2]?.id });
      await feed(p.token);
      const count = async (table: "user_events" | "user_affinities" | "feed_hidden" | "feed_snapshots") => {
        const rows = await ctx.database.db.execute(
          sql`select count(*)::int as n from ${sql.raw(table)} where user_id = ${p.id}`,
        );
        return (rows[0] as { n: number }).n;
      };
      for (const t of ["user_events", "user_affinities", "feed_hidden", "feed_snapshots"] as const) {
        expect(await count(t), t).toBeGreaterThan(0);
      }
      const res = await call("DELETE", "/v1/me", p.token, { password: newPerson().password });
      expect(res.statusCode, res.body).toBe(204);
      for (const t of ["user_events", "user_affinities", "feed_hidden", "feed_snapshots"] as const) {
        expect(await count(t), t).toBe(0);
      }
    });
  });

  describe("after sign up", () => {
    it("counts the picks as weight 3, once, and starts a small taste", async () => {
      const p = await newPersonWith("pick");
      expect(
        (await call("POST", "/v1/me/onboarding-picks", p.token, { picks: ["women", "kids"] })).statusCode,
      ).toBe(204);
      const picks = await eventRows(p.id, "onboarding_pick");
      expect(picks).toHaveLength(2);
      const women = reference.categories.find((c) => c.slug === "women") as CategoryNode;
      const line = (await affinityRows(p.id)).find(
        (a) => a.feature === "parent_category" && a.featureKey === women.id,
      );
      expect(line?.score).toBeCloseTo(3, 1);
      // Answering again changes nothing.
      await call("POST", "/v1/me/onboarding-picks", p.token, { picks: ["women"] });
      expect(await eventRows(p.id, "onboarding_pick")).toHaveLength(2);
      // Skipping is an empty answer.
      expect((await call("POST", "/v1/me/onboarding-picks", p.token, { picks: [] })).statusCode).toBe(204);
      expect((await call("POST", "/v1/me/onboarding-picks", p.token, { picks: ["cats"] })).statusCode).toBe(
        400,
      );
      expect((await call("POST", "/v1/me/onboarding-picks", undefined, { picks: ["men"] })).statusCode).toBe(
        401,
      );
    });
  });

  describe("upkeep", () => {
    it("re-counts popular this week", async () => {
      const viewer = await newPersonWith("pop");
      const target = itemsB[0] as { id: string };
      await call("GET", `/v1/listings/${target.id}`, viewer.token);
      await call("PUT", `/v1/listings/${target.id}/favourite`, viewer.token);
      await refreshPopularity(ctx.app);
      const [row] = await ctx.database.db
        .select()
        .from(listingPopularity7d)
        .where(eq(listingPopularity7d.listingId, target.id));
      expect(row?.pop).toBeGreaterThanOrEqual(5);
    });

    it("deletes old actions, faded taste and extra lines in the nightly cleanup", async () => {
      const p = await newPersonWith("clean");
      const db = ctx.database.db;
      const at = (days: number) => new Date(Date.now() - days * 86_400_000);
      const target = itemsA[0] as { id: string };
      await db.insert(userEvents).values([
        { userId: p.id, type: "listing_open", listingId: target.id, occurredAt: at(200) },
        { userId: p.id, type: "listing_open", listingId: target.id, occurredAt: at(100) },
        { userId: p.id, type: "impression", listingId: target.id, occurredAt: at(40) },
        { userId: p.id, type: "impression", listingId: target.id, occurredAt: at(10) },
      ]);
      await db.insert(userAffinities).values([
        { userId: p.id, feature: "brand", featureKey: "old", score: 1, scoredAt: at(60) },
        { userId: p.id, feature: "brand", featureKey: "fresh", score: 5, scoredAt: at(0) },
        ...Array.from({ length: 55 }, (_, i) => ({
          userId: p.id,
          feature: "seller" as const,
          featureKey: `seller-${i}`,
          score: 10 + i,
          scoredAt: at(0),
        })),
      ]);
      await call("PUT", `/v1/listings/${itemsB[1]?.id}/favourite`, p.token);
      const old = new Date(Date.now() - 7 * 3_600_000);
      const [snap] = await db
        .insert(feedSnapshots)
        .values({ userId: p.id, listingIds: [], reasons: [], createdAt: old })
        .returning();

      const result = await cleanupFeedData(ctx.app);
      expect(result.events).toBeGreaterThanOrEqual(1);
      expect(result.impressions).toBeGreaterThanOrEqual(1);
      expect(result.snapshots).toBeGreaterThanOrEqual(1);
      expect(result.fadedAffinities).toBeGreaterThanOrEqual(1);
      expect(result.extraAffinities).toBeGreaterThanOrEqual(5);

      const kinds = (await eventRows(p.id)).map((e) => `${e.type}`).sort();
      expect(kinds).toEqual(["favourite", "impression", "listing_open"]);
      const lines = await affinityRows(p.id);
      expect(lines.filter((l) => l.feature === "seller")).toHaveLength(50);
      expect(lines.some((l) => l.featureKey === "old")).toBe(false);
      expect(lines.some((l) => l.featureKey === "fresh")).toBe(true);
      expect(lines.some((l) => l.featureKey === "seller-0")).toBe(false);
      expect(
        await db
          .select()
          .from(feedSnapshots)
          .where(eq(feedSnapshots.id, (snap as { id: string }).id)),
      ).toHaveLength(0);
    });

    it("protects the scheduler endpoints with a secret", async () => {
      for (const url of ["/v1/jobs/feed-popularity", "/v1/jobs/feed-cleanup"]) {
        expect((await call("GET", url)).statusCode).toBe(401);
        const wrong = await ctx.app.inject({ method: "GET", url, headers: { authorization: "Bearer nope" } });
        expect(wrong.statusCode).toBe(401);
        const ok = await ctx.app.inject({
          method: "GET",
          url,
          headers: { authorization: "Bearer test-cron-secret-0123456789" },
        });
        expect(ok.statusCode, ok.body).toBe(200);
        expect(ok.json().ok).toBe(true);
        const post = await ctx.app.inject({
          method: "POST",
          url,
          headers: { authorization: "Bearer test-cron-secret-0123456789" },
        });
        expect(post.statusCode).toBe(200);
      }
    });

    it("answers 404 when no secret is set", async () => {
      const bare = await buildTestApp();
      try {
        const res = await bare.app.inject({
          method: "GET",
          url: "/v1/jobs/feed-cleanup",
          headers: { authorization: "Bearer x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await bare.close();
      }
    });
  });
});
