import type { PhotoSuggestion, ReferenceData } from "@vinty/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalog } from "../lib/photo-assist.js";
import { fakePhotoReader, type RawReading } from "../lib/photo-reader.js";
import type { Storage } from "../lib/storage.js";
import {
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  fakeStorage,
  newPerson,
  type TestContext,
} from "../test-helpers.js";

/** Storage that has a tiny "photo" for every key, so the route has something to hand the reader. */
const storageWithPhotos: Storage = {
  ...fakeStorage,
  async read() {
    return Buffer.from("not-really-a-jpeg");
  },
};

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("photo helper", () => {
  const createdIds: string[] = [];
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  let reference: ReferenceData;
  let catalog: ReturnType<typeof buildCatalog>;

  async function withApp(answer: Parameters<typeof fakePhotoReader>[0]) {
    const reader = fakePhotoReader(answer);
    const ctx = await buildTestApp({}, { photoReader: reader, storage: storageWithPhotos });
    const person = newPerson("assist");
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
    const token = res.headers["set-auth-token"] as string;
    const id = body.user.id as string;
    const suggest = (over: Record<string, unknown> = {}) =>
      ctx.app.inject({
        method: "POST",
        url: "/v1/listings/suggest",
        headers: bearer(token),
        payload: { photoKeys: [`listings/${id}/a.jpg`], language: "en", ...over },
      });
    return { ctx, reader, id, token, suggest };
  }

  const contexts: TestContext[] = [];
  beforeAll(async () => {
    const probe = await buildTestApp();
    contexts.push(probe);
    reference = (await probe.app.inject({ method: "GET", url: "/v1/reference" })).json();
    catalog = buildCatalog(reference);
  });
  afterAll(async () => {
    const first = contexts[0];
    if (first) await cleanupTestUsers(first.database, createdIds, { onlyIds: true });
    await Promise.all(contexts.map((c) => c.close()));
  });

  it("is off without a key: the status says so and a suggestion is empty", async () => {
    const t = await withApp(undefined);
    contexts.push(t.ctx);
    const status = await t.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
    expect(status.json()).toEqual({ photoAssist: false });
    const res = await t.suggest();
    expect(res.statusCode).toBe(200);
    const body = res.json() as PhotoSuggestion;
    expect(body.categories).toEqual([]);
    expect(body.title).toBeNull();
    expect(t.reader.calls).toHaveLength(0);
  });

  it("says it is on when a reader is there", async () => {
    const t = await withApp({});
    contexts.push(t.ctx);
    const status = await t.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
    expect(status.json()).toEqual({ photoAssist: true });
  });

  it("needs a signed in person", async () => {
    const t = await withApp({});
    contexts.push(t.ctx);
    const res = await t.ctx.app.inject({
      method: "POST",
      url: "/v1/listings/suggest",
      payload: { photoKeys: ["listings/x/a.jpg"], language: "en" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("refuses photos that belong to someone else, and never reads them", async () => {
    const t = await withApp({});
    contexts.push(t.ctx);
    const res = await t.suggest({ photoKeys: [`listings/${t.id}/a.jpg`, "listings/someone-else/b.jpg"] });
    expect(res.statusCode).toBe(400);
    const dots = await t.suggest({ photoKeys: [`listings/${t.id}/../other/c.jpg`] });
    expect(dots.statusCode).toBe(400);
    expect(t.reader.calls).toHaveLength(0);
  });

  it("checks the request: 1 to 4 photos and a known language", async () => {
    const t = await withApp({});
    contexts.push(t.ctx);
    expect((await t.suggest({ photoKeys: [] })).statusCode).toBe(400);
    expect((await t.suggest({ language: "fr" })).statusCode).toBe(400);
    const five = Array.from({ length: 5 }, (_, i) => `listings/${t.id}/${i}.jpg`);
    expect((await t.suggest({ photoKeys: five })).statusCode).toBe(400);
  });

  it("turns codes into real ids and drops anything not in our lists", async () => {
    const [first, second, third, fourth] = [...catalog.categories.keys()] as string[];
    const answer: RawReading = {
      categories: [
        { code: first, confidence: 0.6 },
        { code: "C99999", confidence: 0.5 },
        { code: first, confidence: 0.4 },
        { code: second, confidence: 0.3 },
        { code: third, confidence: 0.2 },
        { code: fourth, confidence: 0.1 },
      ],
      colours: ["K1", "K2", "K3", "K999"],
    };
    const t = await withApp(answer);
    contexts.push(t.ctx);
    const res = await t.suggest({ photoKeys: [`listings/${t.id}/a.jpg`, `listings/${t.id}/b.jpg`] });
    expect(res.statusCode).toBe(200);
    const body = res.json() as PhotoSuggestion;
    // Best first, a made up code and a repeat are dropped, and there are never more than 3.
    expect(body.categories).toEqual([
      { id: catalog.categories.get(first as string), confidence: 0.6 },
      { id: catalog.categories.get(second as string), confidence: 0.3 },
      { id: catalog.categories.get(third as string), confidence: 0.2 },
    ]);
    expect(body.colourIds).toEqual([catalog.colours.get("K1"), catalog.colours.get("K2")]);
    expect(body.materialId).toBeNull();
    expect(body.title).toBeNull();
    expect(body.description).toBeNull();
    expect(t.reader.calls).toHaveLength(1);
    expect(t.reader.calls[0]?.images).toHaveLength(2);
  });

  it("passes a made up category through as nothing", async () => {
    const t = await withApp({
      categories: [{ code: "00000000-0000-4000-8000-000000000000", confidence: 1 }],
    });
    contexts.push(t.ctx);
    const body = (await t.suggest()).json() as PhotoSuggestion;
    expect(body.categories).toEqual([]);
  });

  it("matches a brand read from a tag to our brands, ignoring case and accents", async () => {
    const brands = (await buildTestApp()).app;
    const all = (await brands.inject({ method: "GET", url: "/v1/brands?limit=50" })).json().items as {
      id: string;
      name: string;
    }[];
    const target = all[0] as { id: string; name: string };
    const shout = target.name.toUpperCase().replace(/E/g, "É");
    const t = await withApp({ brandText: shout });
    contexts.push(t.ctx);
    const body = (await t.suggest()).json() as PhotoSuggestion;
    expect(body.brand).toEqual({ id: target.id, name: target.name });

    // A tag that says a bit more than the brand still finds it.
    const longer = await withApp({ brandText: `${target.name} Basic` });
    contexts.push(longer.ctx);
    expect(((await longer.suggest()).json() as PhotoSuggestion).brand?.id).toBe(target.id);
  });

  it("keeps an unknown brand as text only", async () => {
    const t = await withApp({ brandText: "Zzyzx Unheard Of" });
    contexts.push(t.ctx);
    const body = (await t.suggest()).json() as PhotoSuggestion;
    expect(body.brand).toEqual({ id: null, name: "Zzyzx Unheard Of" });
  });

  it("answers with an empty suggestion, not an error, when the reader fails", async () => {
    const t = await withApp(() => {
      throw new Error("model fell over");
    });
    contexts.push(t.ctx);
    const res = await t.suggest();
    expect(res.statusCode).toBe(200);
    expect((res.json() as PhotoSuggestion).title).toBeNull();
  });

  it("answers empty when none of the photos can be read from storage", async () => {
    const reader = fakePhotoReader({ colours: ["K1"] });
    const ctx = await buildTestApp({}, { photoReader: reader });
    contexts.push(ctx);
    const person = newPerson("assist");
    const up = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: {
        email: person.email,
        password: person.password,
        name: person.username,
        username: person.username,
      },
    });
    createdIds.push(up.json().user.id);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/listings/suggest",
      headers: bearer(up.headers["set-auth-token"] as string),
      payload: { photoKeys: [`listings/${up.json().user.id}/a.jpg`], language: "en" },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as PhotoSuggestion).title).toBeNull();
    expect(reader.calls).toHaveLength(0);
  });

  it("allows 20 reads an hour per person, then asks to wait", async () => {
    const t = await withApp({ colours: ["K1"] });
    contexts.push(t.ctx);
    for (let i = 0; i < 20; i++) expect((await t.suggest()).statusCode).toBe(200);
    const over = await t.suggest();
    expect(over.statusCode).toBe(429);
    expect(over.headers["retry-after"]).toBeDefined();
    expect(t.reader.calls).toHaveLength(20);
  });
});
