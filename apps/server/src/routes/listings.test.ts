import { brandRequests, listingPhotos, listingPriceHistory, listings, profiles } from "@vinty/db";
import { type CategoryNode, findCategory, type ReferenceData } from "@vinty/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupTestUsers, databaseUrl, newPerson, type TestContext } from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("selling", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  let reference: ReferenceData;
  let sized: CategoryNode; // a leaf that needs a size
  let plain: CategoryNode; // a leaf with no size row
  let brandId: string;
  let seller: { token: string; id: string };
  let other: { token: string; id: string };

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  async function signUp(label: string) {
    const person = newPerson(label);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: {
        email: person.email,
        password: person.password,
        name: person.username,
        username: person.username,
      },
    });
    const body = res.json();
    createdIds.push(body.user.id);
    return { token: res.headers["set-auth-token"] as string, id: body.user.id as string };
  }

  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));

  let photoCounter = 0;
  const photo = (userId: string) => {
    photoCounter += 1;
    return { key: `listings/${userId}/test-${Date.now()}-${photoCounter}.jpg`, width: 900, height: 1200 };
  };

  function complete(userId: string, over: Record<string, unknown> = {}) {
    const sizeGroup = reference.sizeGroups.find((g) => sized.sizeGroupIds.includes(g.id));
    return {
      title: "Linen summer dress",
      description: "Worn twice, no marks",
      categoryId: sized.id,
      brandId,
      sizeId: sizeGroup?.sizes[0]?.id,
      conditionId: reference.conditions[0]?.id,
      colourIds: [reference.colours[0]?.id],
      priceMinor: 12000,
      parcelSizeId: reference.parcelSizes[0]?.id,
      photos: [photo(userId), photo(userId), photo(userId)],
      ...over,
    };
  }

  const create = (token: string, payload: Record<string, unknown>) =>
    ctx.app.inject({ method: "POST", url: "/v1/listings", headers: bearer(token), payload });

  beforeAll(async () => {
    ctx = await buildTestApp();
    reference = (await ctx.app.inject({ method: "GET", url: "/v1/reference" })).json();
    const all = leaves(reference.categories);
    sized = all.find((c) => c.rules.size === "required" && c.sizeGroupIds.length > 0) as CategoryNode;
    plain = all.find((c) => c.rules.size === "hidden" && c.rules.brand === "hidden") as CategoryNode;
    brandId = (await ctx.app.inject({ method: "GET", url: "/v1/brands?limit=1" })).json().items[0].id;
    seller = await signUp("seller");
    other = await signUp("other");
  });
  afterAll(async () => {
    await ctx.database.db.delete(brandRequests).where(eq(brandRequests.userId, seller.id));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("reference data", () => {
    it("serves the category tree with rules, cacheable with an ETag", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/v1/reference" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toContain("max-age=3600");
      const etag = res.headers.etag as string;
      expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
      expect(sized.rules.size).toBe("required");
      expect(findCategory(reference.categories, sized.id)?.name.he).toBeTruthy();
      expect(reference.settings.listing_max_photos).toBe(20);
      expect(reference.feeRules.find((f) => f.currency === "ILS")?.buyerFeeBasisPoints).toBe(500);

      const again = await ctx.app.inject({
        method: "GET",
        url: "/v1/reference",
        headers: { "if-none-match": etag },
      });
      expect(again.statusCode).toBe(304);
    });

    it("finds brands by the start of a word and lists popular ones first", async () => {
      const popular = (await ctx.app.inject({ method: "GET", url: "/v1/brands?limit=5" })).json();
      expect(popular.items).toHaveLength(5);
      expect(popular.nextCursor).toBeTruthy();
      const first = popular.items[0].name as string;
      const found = (
        await ctx.app.inject({ method: "GET", url: `/v1/brands?q=${encodeURIComponent(first.slice(0, 3))}` })
      ).json();
      expect(found.items.map((b: { name: string }) => b.name)).toContain(first);
    });

    it("takes a brand request once per name", async () => {
      for (const name of ["Tiny Label", "tiny label"]) {
        const res = await ctx.app.inject({
          method: "POST",
          url: "/v1/brand-requests",
          headers: bearer(seller.token),
          payload: { name },
        });
        expect(res.statusCode).toBe(204);
      }
      const rows = await ctx.database.db
        .select()
        .from(brandRequests)
        .where(eq(brandRequests.userId, seller.id));
      expect(rows).toHaveLength(1);
    });

    it("previews the buyer price with the 5 percent fee", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/v1/pricing/preview?priceMinor=4500" });
      expect(res.json()).toEqual({
        priceMinor: 4500,
        currency: "ILS",
        buyerProtectionFeeMinor: 225,
        buyerPriceMinor: 4725,
      });
    });
  });

  describe("create and validate", () => {
    it("publishes a complete listing with photos in order", async () => {
      const payload = complete(seller.id, { publish: true });
      const res = await create(seller.token, payload);
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe("active");
      expect(body.priceMinor).toBe(12000);
      expect(body.buyerPriceMinor).toBe(12600);
      expect(body.photos.map((p: { key: string }) => p.key)).toEqual(payload.photos.map((p) => p.key));
      expect(body.cover.key).toBe(payload.photos[0]?.key);
      expect(body.category.breadcrumb.length).toBeGreaterThan(1);
      expect(body.viewer.isOwner).toBe(true);
      const [profile] = await ctx.database.db.select().from(profiles).where(eq(profiles.userId, seller.id));
      expect(profile?.activeListingCount).toBe(1);
    });

    it("refuses to publish without what the category requires, field by field", async () => {
      const res = await create(
        seller.token,
        complete(seller.id, { sizeId: null, photos: [], publish: true }),
      );
      expect(res.statusCode).toBe(400);
      expect(res.json().error.fields).toMatchObject({
        sizeId: "validation.listing.size.required",
        photos: "validation.listing.photos.required",
      });
    });

    it("refuses a price under the minimum and a size from another category", async () => {
      const wrongSize = reference.sizeGroups.find((g) => !sized.sizeGroupIds.includes(g.id))?.sizes[0]?.id;
      const res = await create(
        seller.token,
        complete(seller.id, { priceMinor: 50, sizeId: wrongSize, publish: true }),
      );
      expect(res.json().error.fields).toMatchObject({
        priceMinor: "validation.listing.price.tooLow",
        sizeId: "validation.listing.size.invalid",
      });
    });

    it("drops values for rows the category hides", async () => {
      const res = await create(
        seller.token,
        complete(seller.id, { categoryId: plain.id, sizeId: undefined, publish: true }),
      );
      expect(res.statusCode).toBe(201);
      expect(res.json().brand).toBeNull();
      expect(res.json().size).toBeNull();
    });

    it("accepts a brand that is not on the list, cleaned up, and keeps it through edits", async () => {
      const res = await create(
        seller.token,
        complete(seller.id, { brandId: null, brandName: "  Old\u0000  Mill \n Co  ", publish: true }),
      );
      expect(res.statusCode).toBe(201);
      expect(res.json().brand).toEqual({ id: null, name: "Old Mill Co" });
      const id = res.json().id as string;

      // An edit that does not mention the brand keeps it.
      const edit = await ctx.app.inject({
        method: "PATCH",
        url: `/v1/listings/${id}`,
        headers: bearer(seller.token),
        payload: { title: "Linen summer dress again" },
      });
      expect(edit.statusCode).toBe(200);
      expect(edit.json().brand).toEqual({ id: null, name: "Old Mill Co" });

      // Picking a listed brand replaces it, and the card text follows.
      const listed = await ctx.app.inject({
        method: "PATCH",
        url: `/v1/listings/${id}`,
        headers: bearer(seller.token),
        payload: { brandId, brandName: "Ignored Text" },
      });
      expect(listed.json().brand.id).toBe(brandId);
      expect(listed.json().brand.name).not.toBe("Ignored Text");

      // Clearing it on a category that requires a brand is refused.
      const cleared = await ctx.app.inject({
        method: "PATCH",
        url: `/v1/listings/${id}`,
        headers: bearer(seller.token),
        payload: { brandId: null, brandName: null },
      });
      if (sized.rules.brand === "required") expect(cleared.statusCode).toBe(400);
    });

    it("refuses a typed brand that is too short or too long", async () => {
      for (const brandName of ["a", "x".repeat(61), " \u0007 "]) {
        const res = await create(seller.token, complete(seller.id, { brandId: null, brandName }));
        expect(res.statusCode).toBe(400);
      }
    });

    it("drops a typed brand in a category that hides brands", async () => {
      const res = await create(
        seller.token,
        complete(seller.id, {
          categoryId: plain.id,
          sizeId: undefined,
          brandId: null,
          brandName: "Old Mill",
        }),
      );
      expect(res.statusCode).toBe(201);
      expect(res.json().brand).toBeNull();
    });

    it("limits photos to the platform setting and to the seller's own uploads", async () => {
      const many = Array.from({ length: 21 }, () => photo(seller.id));
      const tooMany = await create(seller.token, complete(seller.id, { photos: many }));
      expect(tooMany.json().error.fields.photos).toBe("validation.listing.photos.tooMany");

      const stolen = await create(seller.token, complete(seller.id, { photos: [photo(other.id)] }));
      expect(stolen.json().error.fields.photos).toBe("validation.listing.photos.invalid");
    });

    it("needs a session", async () => {
      const res = await ctx.app.inject({ method: "POST", url: "/v1/listings", payload: {} });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("drafts", () => {
    it("saves a partial draft, lists it, resumes it and publishes it", async () => {
      const draft = await create(seller.token, { title: "Half done", categoryId: sized.id });
      expect(draft.statusCode).toBe(201);
      const id = draft.json().id as string;
      expect(draft.json().status).toBe("draft");
      expect(draft.json().priceMinor).toBeNull();

      const list = (
        await ctx.app.inject({
          method: "GET",
          url: "/v1/me/listings?status=draft",
          headers: bearer(seller.token),
        })
      ).json();
      expect(list.items.map((i: { id: string }) => i.id)).toContain(id);
      expect(list.counts.draft).toBeGreaterThanOrEqual(1);

      const early = await ctx.app.inject({
        method: "POST",
        url: `/v1/listings/${id}/publish`,
        headers: bearer(seller.token),
      });
      expect(early.statusCode).toBe(400);

      const { title: _t, ...rest } = complete(seller.id);
      const resumed = await ctx.app.inject({
        method: "PATCH",
        url: `/v1/listings/${id}`,
        headers: bearer(seller.token),
        payload: rest,
      });
      expect(resumed.statusCode).toBe(200);
      expect(resumed.json().title).toBe("Half done");

      const published = await ctx.app.inject({
        method: "POST",
        url: `/v1/listings/${id}/publish`,
        headers: bearer(seller.token),
      });
      expect(published.json().status).toBe("active");
      expect(published.json().publishedAt).toBeTruthy();
    });

    it("lets a draft be saved empty", async () => {
      const res = await create(seller.token, {});
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe("");
    });
  });

  describe("edit, state and delete", () => {
    let id: string;
    beforeAll(async () => {
      id = (await create(seller.token, complete(seller.id, { publish: true }))).json().id;
    });

    it("records a price drop", async () => {
      const res = await ctx.app.inject({
        method: "PATCH",
        url: `/v1/listings/${id}`,
        headers: bearer(seller.token),
        payload: { priceMinor: 9000 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().previousPriceMinor).toBe(12000);
      const history = await ctx.database.db
        .select()
        .from(listingPriceHistory)
        .where(eq(listingPriceHistory.listingId, id));
      expect(history).toHaveLength(1);
    });

    it("keeps a live listing complete", async () => {
      const res = await ctx.app.inject({
        method: "PATCH",
        url: `/v1/listings/${id}`,
        headers: bearer(seller.token),
        payload: { title: "" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.fields.title).toBe("validation.listing.title.required");
    });

    it("reorders photos and sets a new cover", async () => {
      const current = (
        await ctx.app.inject({ method: "GET", url: `/v1/me/listings/${id}`, headers: bearer(seller.token) })
      ).json();
      const reversed = [...current.photos]
        .reverse()
        .map((p: { key: string; width: number; height: number }) => ({
          key: p.key,
          width: p.width,
          height: p.height,
        }));
      const res = await ctx.app.inject({
        method: "PUT",
        url: `/v1/listings/${id}/photos`,
        headers: bearer(seller.token),
        payload: { photos: reversed },
      });
      expect(res.json().cover.key).toBe(reversed[0]?.key);
      const empty = await ctx.app.inject({
        method: "PUT",
        url: `/v1/listings/${id}/photos`,
        headers: bearer(seller.token),
        payload: { photos: [] },
      });
      expect(empty.statusCode).toBe(400);
    });

    it("reserves, unreserves, hides, shows and sells by hand, and refuses the rest", async () => {
      const move = (status: string) =>
        ctx.app.inject({
          method: "PATCH",
          url: `/v1/listings/${id}/status`,
          headers: bearer(seller.token),
          payload: { status },
        });
      expect((await move("reserved")).json().status).toBe("reserved");
      expect((await move("hidden")).statusCode).toBe(409);
      expect((await move("active")).json().status).toBe("active");
      expect((await move("hidden")).json().status).toBe("hidden");
      expect((await move("sold")).statusCode).toBe(409);
      expect((await move("active")).json().status).toBe("active");
      expect((await move("sold")).json().status).toBe("sold");
      expect((await move("active")).statusCode).toBe(409);
      const edit = await ctx.app.inject({
        method: "PATCH",
        url: `/v1/listings/${id}`,
        headers: bearer(seller.token),
        payload: { priceMinor: 100 },
      });
      expect(edit.statusCode).toBe(409);
    });

    it("hides someone else's listing behind a 404 on every route", async () => {
      const h = bearer(other.token);
      const calls = [
        ctx.app.inject({ method: "GET", url: `/v1/me/listings/${id}`, headers: h }),
        ctx.app.inject({
          method: "PATCH",
          url: `/v1/listings/${id}`,
          headers: h,
          payload: { title: "Mine now" },
        }),
        ctx.app.inject({
          method: "PUT",
          url: `/v1/listings/${id}/photos`,
          headers: h,
          payload: { photos: [] },
        }),
        ctx.app.inject({ method: "POST", url: `/v1/listings/${id}/publish`, headers: h }),
        ctx.app.inject({
          method: "PATCH",
          url: `/v1/listings/${id}/status`,
          headers: h,
          payload: { status: "hidden" },
        }),
        ctx.app.inject({ method: "DELETE", url: `/v1/listings/${id}`, headers: h }),
      ];
      for (const res of await Promise.all(calls)) expect(res.statusCode).toBe(404);
      const own = (await ctx.app.inject({ method: "GET", url: "/v1/me/listings", headers: h })).json();
      expect(own.items.map((i: { id: string }) => i.id)).not.toContain(id);
    });

    it("deletes a listing with its photos", async () => {
      const fresh = (await create(seller.token, complete(seller.id, { publish: true }))).json().id as string;
      const res = await ctx.app.inject({
        method: "DELETE",
        url: `/v1/listings/${fresh}`,
        headers: bearer(seller.token),
      });
      expect(res.statusCode).toBe(204);
      expect(await ctx.database.db.select().from(listings).where(eq(listings.id, fresh))).toHaveLength(0);
      expect(
        await ctx.database.db.select().from(listingPhotos).where(eq(listingPhotos.listingId, fresh)),
      ).toHaveLength(0);
    });
  });

  // Sixty requests in a row can take more than the default 5 seconds on a busy machine.
  it("rate limits writes at 60 a minute", async () => {
    const limited = await buildTestApp();
    try {
      const login = await limited.app.inject({ method: "GET", url: "/v1/reference" });
      expect(login.statusCode).toBe(200);
      let last = 0;
      for (let i = 0; i < 61; i += 1) {
        const res = await limited.app.inject({
          method: "DELETE",
          url: "/v1/listings/00000000-0000-4000-8000-000000000000",
          headers: bearer(seller.token),
        });
        last = res.statusCode;
      }
      expect(last).toBe(429);
    } finally {
      await limited.close();
    }
  }, 30_000);
});
