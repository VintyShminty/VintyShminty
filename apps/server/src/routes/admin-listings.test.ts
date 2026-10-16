import { adminActions, listings, users } from "@vinty/db";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Storage } from "../lib/storage.js";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  fakeStorage,
  publishQuietListing,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

describe.skipIf(!databaseUrl)("admin edit any listing", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  let admin: TestPerson;
  let seller: TestPerson;
  let other: TestPerson;
  let listingId: string;
  const stamp = Date.now().toString(36);
  const db = () => ctx.database.db;

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    [admin, seller, other] = await Promise.all([
      signUpTestUser(ctx, "aled", createdIds),
      signUpTestUser(ctx, "alsel", createdIds),
      signUpTestUser(ctx, "aloth", createdIds),
    ]);
    await db().update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    listingId = await publishQuietListing(ctx, seller, `Admin edit ${stamp}`);
  });
  afterAll(async () => {
    await db().delete(adminActions).where(inArray(adminActions.adminUserId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("keeps everyone but admins out", async () => {
    const attempts: ["GET" | "PATCH", string, object?][] = [
      ["GET", "/v1/admin/listings"],
      ["GET", `/v1/admin/listings/${listingId}`],
      ["PATCH", `/v1/admin/listings/${listingId}`, { title: "Nope" }],
      ["PATCH", `/v1/admin/listings/${listingId}/status`, { status: "hidden" }],
    ];
    for (const [method, url, body] of attempts) {
      expect((await call(method, url, undefined, body)).statusCode).toBe(401);
      expect((await call(method, url, other.token, body)).statusCode).toBe(403);
    }
    // The normal route still refuses a person who does not own the listing.
    expect(
      (await call("PATCH", `/v1/listings/${listingId}`, other.token, { title: "Nope" })).statusCode,
    ).toBe(404);
  });

  it("finds a listing by title and by seller username", async () => {
    const byTitle = (
      await call("GET", `/v1/admin/listings?q=${encodeURIComponent(`Admin edit ${stamp}`)}`, admin.token)
    ).json();
    expect(byTitle.items.map((i: { id: string }) => i.id)).toEqual([listingId]);
    const bySeller = (
      await call("GET", `/v1/admin/listings?q=${seller.username}&limit=1`, admin.token)
    ).json();
    expect(bySeller.items[0]).toMatchObject({ id: listingId, sellerUsername: seller.username });
  });

  it("lets an admin edit someone else's listing and writes the log", async () => {
    const res = await call("PATCH", `/v1/admin/listings/${listingId}`, admin.token, {
      title: `Edited by admin ${stamp}`,
      priceMinor: 7000,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: `Edited by admin ${stamp}`, priceMinor: 7000 });
    const [row] = await db().select().from(listings).where(eq(listings.id, listingId));
    expect(row).toMatchObject({ title: `Edited by admin ${stamp}`, priceMinor: 7000, sellerId: seller.id });
    const [audit] = await db()
      .select()
      .from(adminActions)
      .where(and(eq(adminActions.targetId, listingId), eq(adminActions.action, "listing_edited")));
    expect(audit?.adminUserId).toBe(admin.id);
    expect(audit?.details).toMatchObject({ changed: ["title", "priceMinor"], priceTo: 7000 });
  });

  it("still applies the listing rules and the seller's photo folder", async () => {
    const empty = await call("PATCH", `/v1/admin/listings/${listingId}`, admin.token, { title: "" });
    expect(empty.statusCode).toBe(400);
    const foreign = await call("PATCH", `/v1/admin/listings/${listingId}`, admin.token, {
      photos: [{ key: `listings/${other.id}/x.jpg`, width: 10, height: 10 }],
    });
    expect(foreign.statusCode).toBe(400);
    const upload = await call("POST", `/v1/admin/listings/${listingId}/uploads`, admin.token, {
      contentType: "image/jpeg",
      byteSize: 1000,
    });
    expect(upload.json().key).toContain(`listings/${seller.id}/`);
    const added = await call("PATCH", `/v1/admin/listings/${listingId}`, admin.token, {
      photos: [{ key: upload.json().key, width: 900, height: 1200 }],
    });
    expect(added.statusCode).toBe(200);
    expect(added.json().photos).toHaveLength(1);
  });

  it("hides, restores and removes a listing, each time with a log row", async () => {
    const hide = await call("PATCH", `/v1/admin/listings/${listingId}/status`, admin.token, {
      status: "hidden",
      note: "Not allowed",
    });
    expect(hide.json().status).toBe("hidden");
    // The seller cannot undo it.
    expect(
      (await call("PATCH", `/v1/listings/${listingId}/status`, seller.token, { status: "active" }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await call("PATCH", `/v1/admin/listings/${listingId}/status`, admin.token, { status: "active" })
      ).json().status,
    ).toBe("active");
    expect(
      (
        await call("PATCH", `/v1/admin/listings/${listingId}/status`, admin.token, { status: "removed" })
      ).json().status,
    ).toBe("removed");
    const rows = await db()
      .select()
      .from(adminActions)
      .where(and(eq(adminActions.targetId, listingId), eq(adminActions.action, "listing_status_changed")));
    expect(rows).toHaveLength(3);
  });
});

describe.skipIf(!databaseUrl)("admin rotates and crops a listing photo", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  const stored = new Map<string, Buffer>();
  let admin: TestPerson;
  let seller: TestPerson;
  let other: TestPerson;
  let listingId: string;
  const stamp = Date.now().toString(36);
  const db = () => ctx.database.db;

  beforeAll(async () => {
    // A wide picture: 40 by 20 pixels.
    const wide = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#808080" } })
      .jpeg()
      .toBuffer();
    const storage: Storage = {
      ...fakeStorage,
      read: async (key) => (key.includes("missing") ? null : wide),
      put: async (key, body) => {
        stored.set(key, body);
      },
    };
    ctx = await buildTestApp({}, { storage });
    call = apiCaller(ctx);
    [admin, seller, other] = await Promise.all([
      signUpTestUser(ctx, "apred", createdIds),
      signUpTestUser(ctx, "apsel", createdIds),
      signUpTestUser(ctx, "apoth", createdIds),
    ]);
    await db().update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    listingId = await publishQuietListing(ctx, seller, `Admin photo ${stamp}`);
  });
  afterAll(async () => {
    await db().delete(adminActions).where(inArray(adminActions.adminUserId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  const rect = { x: 0.5, y: 0, width: 0.5, height: 1 };

  it("turns a photo in the seller's folder and writes a log row", async () => {
    const key = `listings/${seller.id}/a.jpg`;
    const res = await call("POST", `/v1/admin/listings/${listingId}/photos/rotate`, admin.token, { key });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.key.startsWith(`listings/${seller.id}/`)).toBe(true);
    expect(body.key).not.toBe(key);
    const meta = await sharp(stored.get(body.key)).metadata();
    expect([meta.width, meta.height]).toEqual([20, 40]);
    const [audit] = await db()
      .select()
      .from(adminActions)
      .where(and(eq(adminActions.targetId, listingId), eq(adminActions.action, "listing_photo_rotated")));
    expect(audit?.details).toMatchObject({ from: key, to: body.key, sellerId: seller.id });
  });

  it("crops a photo in the seller's folder and writes a log row", async () => {
    const key = `listings/${seller.id}/b.jpg`;
    const res = await call("POST", `/v1/admin/listings/${listingId}/photos/crop`, admin.token, {
      key,
      ...rect,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.key.startsWith(`listings/${seller.id}/`)).toBe(true);
    const meta = await sharp(stored.get(body.key)).metadata();
    expect([meta.width, meta.height]).toEqual([20, 20]);
    const [audit] = await db()
      .select()
      .from(adminActions)
      .where(and(eq(adminActions.targetId, listingId), eq(adminActions.action, "listing_photo_cropped")));
    expect(audit?.details).toMatchObject({ from: key, to: body.key, rect });
  });

  it("refuses non admins, other folders and unknown listings", async () => {
    const key = `listings/${seller.id}/a.jpg`;
    const rotateUrl = `/v1/admin/listings/${listingId}/photos/rotate`;
    const cropUrl = `/v1/admin/listings/${listingId}/photos/crop`;
    expect((await call("POST", rotateUrl, other.token, { key })).statusCode).toBe(403);
    expect((await call("POST", cropUrl, seller.token, { key, ...rect })).statusCode).toBe(403);
    expect((await call("POST", rotateUrl, undefined, { key })).statusCode).toBe(401);
    const foreign = `listings/${other.id}/a.jpg`;
    expect((await call("POST", rotateUrl, admin.token, { key: foreign })).statusCode).toBe(400);
    expect((await call("POST", cropUrl, admin.token, { key: foreign, ...rect })).statusCode).toBe(400);
    expect(
      (await call("POST", rotateUrl, admin.token, { key: `listings/${seller.id}/missing.jpg` })).statusCode,
    ).toBe(400);
    const nobody = "00000000-0000-4000-8000-000000000000";
    expect(
      (await call("POST", `/v1/admin/listings/${nobody}/photos/rotate`, admin.token, { key })).statusCode,
    ).toBe(404);
  });
});
