import { killSwitches } from "@vinty/db";
import type { PhotoSuggestion, ReferenceData } from "@vinty/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalog, buildTextCatalog } from "../lib/photo-assist.js";
import { fakePhotoReader, type RawReading } from "../lib/photo-reader.js";
import type { Storage } from "../lib/storage.js";
import { fakeTextReader } from "../lib/text-reader.js";
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
    expect(status.json()).toEqual({
      photoAssist: false,
      textAssist: false,
      searchAssist: false,
    });
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
    expect(status.json().photoAssist).toBe(true);
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

// ---- D-036: photo tips, the tips-only check, text suggestions and the status ----
describe.skipIf(!databaseUrl)("photo tips and text helper", () => {
  const createdIds: string[] = [];
  const contexts: TestContext[] = [];
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  async function setup(opts: {
    photo?: ReturnType<typeof fakePhotoReader>;
    text?: ReturnType<typeof fakeTextReader>;
  }) {
    const ctx = await buildTestApp(
      {},
      {
        storage: storageWithPhotos,
        ...(opts.photo ? { photoReader: opts.photo } : {}),
        ...(opts.text ? { textReader: opts.text } : {}),
      },
    );
    contexts.push(ctx);
    const person = newPerson("tips");
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
    const id = res.json().user.id as string;
    createdIds.push(id);
    const token = res.headers["set-auth-token"] as string;
    const post = (url: string, payload: unknown, auth = true) =>
      ctx.app.inject({
        method: "POST",
        url,
        ...(auth ? { headers: bearer(token) } : {}),
        payload: payload as object,
      });
    return { ctx, id, token, post };
  }

  afterAll(async () => {
    const first = contexts[0];
    if (first) await cleanupTestUsers(first.database, createdIds, { onlyIds: true });
    await Promise.all(contexts.map((c) => c.close()));
  });

  it("puts photo tips into the suggestion, on the right keys", async () => {
    const photo = fakePhotoReader({
      colours: ["K1"],
      photoIssues: [{ photo: 2, issues: ["dark", "contact"] }],
    });
    const t = await setup({ photo });
    const keys = [`listings/${t.id}/a.jpg`, `listings/${t.id}/b.jpg`];
    const body = (
      await t.post("/v1/listings/suggest", { photoKeys: keys, language: "en" })
    ).json() as PhotoSuggestion;
    expect(body.photoTips).toEqual([{ key: keys[1], kinds: ["contact", "dark"] }]);
  });

  describe("photo-check", () => {
    it("returns tips from the check", async () => {
      const photo = fakePhotoReader(undefined, { photoIssues: [{ photo: 1, issues: ["cut_off"] }] });
      const t = await setup({ photo });
      const key = `listings/${t.id}/a.jpg`;
      const res = await t.post("/v1/listings/photo-check", { photoKeys: [key] });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ photoTips: [{ key, kinds: ["cut_off"] }] });
      expect(photo.checkCalls).toHaveLength(1);
      expect(photo.calls).toHaveLength(0);
    });

    it("refuses someone else's photos, needs sign in, and is empty without a key or on failure", async () => {
      const photo = fakePhotoReader(undefined, { photoIssues: [] });
      const t = await setup({ photo });
      expect(
        (await t.post("/v1/listings/photo-check", { photoKeys: ["listings/someone-else/b.jpg"] })).statusCode,
      ).toBe(400);
      expect(photo.checkCalls).toHaveLength(0);
      expect(
        (await t.post("/v1/listings/photo-check", { photoKeys: [`listings/${t.id}/a.jpg`] }, false))
          .statusCode,
      ).toBe(401);

      const off = await setup({ photo: fakePhotoReader() });
      const res = await off.post("/v1/listings/photo-check", { photoKeys: [`listings/${off.id}/a.jpg`] });
      expect(res.json()).toEqual({ photoTips: [] });

      const broken = await setup({
        photo: fakePhotoReader(undefined, () => {
          throw new Error("model fell over");
        }),
      });
      const failed = await broken.post("/v1/listings/photo-check", {
        photoKeys: [`listings/${broken.id}/a.jpg`],
      });
      expect(failed.statusCode).toBe(200);
      expect(failed.json()).toEqual({ photoTips: [] });
    });

    it("allows 20 checks an hour per person", async () => {
      const photo = fakePhotoReader(undefined, { photoIssues: [] });
      const t = await setup({ photo });
      const send = () => t.post("/v1/listings/photo-check", { photoKeys: [`listings/${t.id}/a.jpg`] });
      for (let i = 0; i < 20; i++) expect((await send()).statusCode).toBe(200);
      const over = await send();
      expect(over.statusCode).toBe(429);
      expect(over.headers["retry-after"]).toBeDefined();
    });
  });

  describe("suggest-text", () => {
    it("turns the model's codes into ids", async () => {
      const probe = await setup({});
      const reference = (
        await probe.ctx.app.inject({ method: "GET", url: "/v1/reference" })
      ).json() as ReferenceData;
      const catalog = buildTextCatalog(reference);
      const text = fakeTextReader({
        categories: [{ code: "C1", confidence: 0.9 }, { code: "C99999" }],
        condition: "Q1",
        colours: ["K1"],
        brandText: "Zzyzx Unheard Of",
      });
      const t = await setup({ text });
      const res = await t.post("/v1/listings/suggest-text", {
        title: "Blue dress, worn twice",
        description: "",
        language: "en",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        categories: [{ id: catalog.categories.get("C1"), confidence: 0.9 }],
        brand: { id: null, name: "Zzyzx Unheard Of" },
        conditionId: catalog.conditions.get("Q1"),
        colourIds: [catalog.colours.get("K1")],
      });
      expect(text.calls).toHaveLength(1);
      expect(text.calls[0]?.catalog).toContain("CONDITIONS");
    });

    it("is empty without a key, and when the model fails", async () => {
      const off = await setup({ text: fakeTextReader() });
      const empty = { categories: [], brand: null, conditionId: null, colourIds: [] };
      const body = { title: "Blue dress", description: "", language: "en" };
      expect((await off.post("/v1/listings/suggest-text", body)).json()).toEqual(empty);
      const broken = await setup({
        text: fakeTextReader(() => {
          throw new Error("model fell over");
        }),
      });
      const res = await broken.post("/v1/listings/suggest-text", body);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(empty);
    });

    it("answers 400 on too little text and 401 signed out", async () => {
      const text = fakeTextReader({});
      const t = await setup({ text });
      expect(
        (await t.post("/v1/listings/suggest-text", { title: " a", description: "", language: "en" }))
          .statusCode,
      ).toBe(400);
      expect(
        (await t.post("/v1/listings/suggest-text", { title: "Blue dress", language: "fr" })).statusCode,
      ).toBe(400);
      expect(
        (
          await t.post(
            "/v1/listings/suggest-text",
            { title: "Blue dress", description: "", language: "en" },
            false,
          )
        ).statusCode,
      ).toBe(401);
      expect(text.calls).toHaveLength(0);
    });

    it("allows 40 reads an hour per person", async () => {
      const text = fakeTextReader({});
      const t = await setup({ text });
      // The per address limit is 30 a minute, so spread the calls over several addresses. The per person limit still counts.
      const send = (n: number) =>
        t.ctx.app.inject({
          method: "POST",
          url: "/v1/listings/suggest-text",
          headers: bearer(t.token),
          remoteAddress: `10.0.0.${n % 5}`,
          payload: { title: "Blue dress", description: "", language: "en" },
        });
      for (let i = 0; i < 40; i++) expect((await send(i)).statusCode).toBe(200);
      const over = await send(40);
      expect(over.statusCode).toBe(429);
      expect(over.headers["retry-after"]).toBeDefined();
    });
  });

  describe("status", () => {
    it("reports both helpers, and false for both when the AI switch is off", async () => {
      const t = await setup({ photo: fakePhotoReader({}), text: fakeTextReader({}) });
      const status = () => t.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
      const db = t.ctx.database.db;
      if (!db) throw new Error("no database");
      await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
      const on = await status();
      expect(on.json()).toEqual({
        photoAssist: true,
        textAssist: true,
        searchAssist: false,
      });
      expect(on.headers["cache-control"]).toBe("public, max-age=60");
      await db.insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused" });
      try {
        // The meter remembers the switch for 30 seconds, so ask a fresh app copy.
        const fresh = await setup({ photo: fakePhotoReader({}), text: fakeTextReader({}) });
        const off = await fresh.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
        expect(off.json()).toEqual({
          photoAssist: false,
          textAssist: false,
          searchAssist: false,
        });
      } finally {
        await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
      }
    });

    it("says text is off when only the photo helper has a key", async () => {
      const t = await setup({ photo: fakePhotoReader({}), text: fakeTextReader() });
      const res = await t.ctx.app.inject({ method: "GET", url: "/v1/sell/assist" });
      expect(res.json()).toEqual({
        photoAssist: true,
        textAssist: false,
        searchAssist: false,
      });
    });
  });
});
