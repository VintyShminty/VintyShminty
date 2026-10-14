import { listingPhotos } from "@vinty/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backfillPhotoVariants } from "../lib/photo-variants.js";
import type { Storage } from "../lib/storage.js";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  fakeStorage,
  publishTestListing,
  signUpTestUser,
  type TestContext,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("photo backfill and card photos", () => {
  const createdIds: string[] = [];
  const stored = new Map<string, Buffer>();
  let jpeg: Buffer;
  let ctx: TestContext;
  let storage: Storage;

  beforeAll(async () => {
    jpeg = await sharp({
      create: {
        width: 900,
        height: 1200,
        channels: 3,
        background: "#808080",
        noise: { type: "gaussian", mean: 120, sigma: 30 },
      },
    })
      .jpeg()
      .toBuffer();
    // Every key reads as a photo, except the ones whose name says otherwise.
    storage = {
      ...fakeStorage,
      read: async (key) =>
        key.includes("missing") ? null : key.includes("broken") ? Buffer.from("x") : jpeg,
      put: async (key, body) => {
        stored.set(key, body);
      },
    };
    ctx = await buildTestApp({ CRON_SECRET: "test-cron-secret-0123456789" }, { storage });
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("fills missing copies, marks unreadable files, leaves missing ones and does not repeat", async () => {
    const owner = await signUpTestUser(ctx, "photos", createdIds);
    const id = await publishTestListing(ctx, owner, "Photo backfill dress");
    const db = ctx.database.db;
    const [row] = await db.select().from(listingPhotos).where(eq(listingPhotos.listingId, id));
    // Saving a listing makes the copy straight away.
    expect(row?.cardObjectKey).toBe(`cards/${row?.objectKey.replace(/\.jpg$/, "")}.webp`);
    expect(row?.placeholder).toBeTruthy();
    // Make it look like an old photo from before copies existed.
    await db
      .update(listingPhotos)
      .set({ cardObjectKey: null, placeholder: null })
      .where(eq(listingPhotos.listingId, id));
    stored.clear();
    const ownerFolder = `listings/${owner.id}`;
    await db.insert(listingPhotos).values([
      { listingId: id, objectKey: `${ownerFolder}/broken.jpg`, width: 10, height: 10, position: 1 },
      { listingId: id, objectKey: `${ownerFolder}/missing.jpg`, width: 10, height: 10, position: 2 },
    ]);

    // The table may hold other people's old photos too, so give the run room and check this listing's rows.
    const result = await backfillPhotoVariants(
      { db, storage, log: ctx.app.log },
      { budgetMs: 60_000, concurrency: 8 },
    );
    expect(result.made).toBeGreaterThanOrEqual(1);

    const rows = await db.select().from(listingPhotos).where(eq(listingPhotos.listingId, id));
    const byKey = new Map(rows.map((r) => [r.objectKey, r]));
    const good = rows.find((r) => r.position === 0);
    expect(good?.cardObjectKey).toBe(`cards/${good?.objectKey.replace(/\.jpg$/, "")}.webp`);
    expect(good?.placeholder).toBeTruthy();
    expect(stored.has(good?.cardObjectKey ?? "")).toBe(true);
    expect(byKey.get(`${ownerFolder}/broken.jpg`)?.cardObjectKey).toBe(`${ownerFolder}/broken.jpg`);
    expect(byKey.get(`${ownerFolder}/missing.jpg`)?.cardObjectKey).toBeNull();

    // A second run only looks at the missing one again and makes nothing.
    const again = await backfillPhotoVariants({ db, storage, log: ctx.app.log }, { budgetMs: 60_000 });
    expect(again.made).toBe(0);
    expect(again.unreadable).toBe(0);

    // Cards point at the small copy, the item page keeps the full photo.
    const detail = await ctx.app.inject({
      method: "GET",
      url: `/v1/listings/${id}`,
      headers: bearer(owner.token),
    });
    const photo0 = detail.json().photos[0];
    expect(photo0.url).toBe(`http://storage.test/${good?.objectKey}`);
    const mine = await ctx.app.inject({
      method: "GET",
      url: "/v1/me/listings?status=active",
      headers: bearer(owner.token),
    });
    const card = (mine.json().items as { id: string; cover: { url: string; key: string } }[]).find(
      (c) => c.id === id,
    );
    expect(card?.cover.url).toBe(`http://storage.test/${good?.cardObjectKey}`);
    expect(card?.cover.key).toBe(good?.objectKey);
  });

  it("is reachable through the daily jobs route", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/jobs/photos",
      headers: { authorization: "Bearer test-cron-secret-0123456789" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, made: expect.any(Number) });
    const all = await ctx.app.inject({
      method: "GET",
      url: "/v1/jobs/all",
      headers: { authorization: "Bearer test-cron-secret-0123456789" },
    });
    expect(all.json().photos).toBeDefined();
  });
});
