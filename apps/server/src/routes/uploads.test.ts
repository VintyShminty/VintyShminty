import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Storage } from "../lib/storage.js";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  fakeStorage,
  signUpTestUser,
  type TestContext,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("rotating an uploaded photo", () => {
  const createdIds: string[] = [];
  const stored = new Map<string, Buffer>();
  let ctx: TestContext;

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
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  const rotate = (token: string | null, body: Record<string, unknown>) =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/uploads/rotate",
      ...(token ? { headers: bearer(token) } : {}),
      payload: body,
    });

  it("turns the picture and saves it under a new key in the same folder", async () => {
    const me = await signUpTestUser(ctx, "rotate", createdIds);
    const key = `listings/${me.id}/old.jpg`;
    const res = await rotate(me.token, { key });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.key).not.toBe(key);
    expect(body.key.startsWith(`listings/${me.id}/`)).toBe(true);
    expect(body.publicUrl).toContain(body.key);
    const meta = await sharp(stored.get(body.key)).metadata();
    expect([meta.width, meta.height]).toEqual([20, 40]);
  });

  it("refuses a photo that is in someone else's folder, one that is missing, and no sign in", async () => {
    const me = await signUpTestUser(ctx, "rotate2", createdIds);
    expect((await rotate(me.token, { key: "listings/someone-else/a.jpg" })).statusCode).toBe(400);
    expect((await rotate(me.token, { key: `listings/${me.id}/missing.jpg` })).statusCode).toBe(400);
    expect((await rotate(null, { key: `listings/${me.id}/a.jpg` })).statusCode).toBe(401);
  });
});

describe.skipIf(!databaseUrl)("cropping an uploaded photo", () => {
  const createdIds: string[] = [];
  const stored = new Map<string, Buffer>();
  let ctx: TestContext;

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
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  const crop = (token: string | null, body: Record<string, unknown>) =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/uploads/crop",
      ...(token ? { headers: bearer(token) } : {}),
      payload: body,
    });

  it("cuts out the rectangle and saves it under a new key in the same folder", async () => {
    const me = await signUpTestUser(ctx, "crop", createdIds);
    const key = `listings/${me.id}/old.jpg`;
    const res = await crop(me.token, { key, x: 0.5, y: 0, width: 0.5, height: 1 });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.key).not.toBe(key);
    expect(body.key.startsWith(`listings/${me.id}/`)).toBe(true);
    expect(body.publicUrl).toContain(body.key);
    const meta = await sharp(stored.get(body.key)).metadata();
    expect([meta.width, meta.height]).toEqual([20, 20]);
  });

  it("refuses a rectangle outside the photo", async () => {
    const me = await signUpTestUser(ctx, "crop2", createdIds);
    const key = `listings/${me.id}/a.jpg`;
    expect((await crop(me.token, { key, x: 0.6, y: 0, width: 0.6, height: 1 })).statusCode).toBe(400);
    expect((await crop(me.token, { key, x: 0, y: 0, width: 0, height: 1 })).statusCode).toBe(400);
    expect((await crop(me.token, { key, x: -0.1, y: 0, width: 0.5, height: 1 })).statusCode).toBe(400);
  });

  it("refuses a photo in someone else's folder, one that is missing, and no sign in", async () => {
    const me = await signUpTestUser(ctx, "crop3", createdIds);
    const rect = { x: 0, y: 0, width: 0.5, height: 0.5 };
    expect((await crop(me.token, { key: "listings/someone-else/a.jpg", ...rect })).statusCode).toBe(400);
    expect((await crop(me.token, { key: `listings/${me.id}/missing.jpg`, ...rect })).statusCode).toBe(400);
    expect((await crop(null, { key: `listings/${me.id}/a.jpg`, ...rect })).statusCode).toBe(401);
  });
});
