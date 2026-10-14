import { createDb, type Database, orders, users, walletEntries } from "@vinty/db";
import type { CategoryNode, ReferenceData } from "@vinty/shared";
import { inArray, like, or } from "drizzle-orm";
import { buildApp } from "./app.js";
import { type Env, parseEnv } from "./env.js";
import { type MemoryMailer, memoryMailer } from "./lib/mail.js";
import type { PhotoReader } from "./lib/photo-reader.js";
import { type MemoryPusher, memoryPusher } from "./lib/push.js";
import type { Storage } from "./lib/storage.js";

export const databaseUrl = process.env.DATABASE_URL;

export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl ?? "postgres://test:test@localhost:5432/test",
    MAIL_TRANSPORT: "memory",
    AUTH_RATE_LIMIT_MAX: "1000",
    JOBS_INTERVAL_SECONDS: "0",
    SIMULATED_DELIVERY_SECONDS: "0",
    ...overrides,
  });
}

/** Storage that never touches the network. */
export const fakeStorage: Storage = {
  async presignUpload({ userId, purpose, contentType }) {
    const folder = { avatar: "avatars", message_photo: "messages", listing_photo: "listings" }[purpose];
    const key = `${folder}/${userId}/fake.${contentType.split("/")[1]}`;
    return {
      key,
      uploadUrl: `http://storage.test/${key}?signed=1`,
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + 300_000),
    };
  },
  publicUrl: (key) => `http://storage.test/${key}`,
  async size() {
    return 2048;
  },
  async read() {
    return null;
  },
  async put() {},
  async markImmutable() {},
  async remove() {},
};

export type TestContext = {
  app: Awaited<ReturnType<typeof buildApp>>;
  mailer: MemoryMailer;
  pusher: MemoryPusher;
  database: Database;
  close: () => Promise<void>;
};

/** Builds the real app against the local database with email kept in memory. */
export async function buildTestApp(
  envOverrides: Record<string, string> = {},
  extras: { photoReader?: PhotoReader; storage?: Storage } = {},
): Promise<TestContext> {
  const env = testEnv(envOverrides);
  // A small pool: some test files keep a dozen apps open at once, and the local database allows 100 connections.
  const database = createDb(env.DATABASE_URL, { max: 5 });
  const mailer = memoryMailer();
  const pusher = memoryPusher();
  const app = await buildApp({
    env,
    database,
    mailer,
    storage: extras.storage ?? fakeStorage,
    pusher,
    ...(extras.photoReader ? { photoReader: extras.photoReader } : {}),
  });
  await app.ready();
  return { app, mailer, pusher, database, close: () => app.close() };
}

let counter = 0;
/** A fresh address and username for each test, all ending in a domain that never receives mail. */
export function newPerson(label = "t") {
  counter += 1;
  const stamp = `${Date.now().toString(36)}${counter}`;
  return {
    email: `vt-${label}-${stamp}@test.invalid`,
    username: `vt_${label}_${stamp}`.slice(0, 24),
    password: "correct-horse-battery",
  };
}

/**
 * Removes every account the tests created, including the ones that were closed and renamed.
 * `onlyIds` removes just the given accounts, so a test file never deletes users another file (running at the same
 * time) still needs.
 */
export async function cleanupTestUsers(database: Database, ids: string[], { onlyIds = false } = {}) {
  const db = database.db;
  const conditions = onlyIds ? [] : [like(users.email, "vt-%@test.invalid")];
  if (ids.length > 0) conditions.push(inArray(users.id, ids));
  if (conditions.length === 0) return;
  // Orders and money rows keep their people (on delete restrict), so they go first.
  const doomed = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(or(...conditions))
  ).map((u) => u.id);
  if (doomed.length > 0) {
    await db.delete(orders).where(or(inArray(orders.buyerId, doomed), inArray(orders.sellerId, doomed)));
    await db.delete(walletEntries).where(inArray(walletEntries.userId, doomed));
  }
  await db.delete(users).where(or(...conditions));
}

export async function waitFor<T>(read: () => T | undefined, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting");
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** The 6 digit code in the newest email sent to an address. */
export async function latestCode(mailer: MemoryMailer, to: string, afterCount = 0): Promise<string> {
  const mail = await waitFor(() => mailer.outbox.filter((m) => m.to === to)[afterCount]);
  const match = mail.text.match(/\b(\d{6})\b/);
  if (!match?.[1]) throw new Error(`No code in email: ${mail.text}`);
  return match[1];
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** Signs up a fresh person and returns the session token. The id goes into `createdIds` for cleanup. */
export async function signUpTestUser(ctx: TestContext, label: string, createdIds: string[]) {
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
  return {
    token: res.headers["set-auth-token"] as string,
    id: body.user.id as string,
    username: person.username,
  };
}

let photoCounter = 0;
/**
 * Publishes a small listing for a test seller and returns its id. Needs the seeded reference data
 * (pnpm db:reset), like the other tests that touch listings.
 */
export async function publishTestListing(
  ctx: TestContext,
  owner: { token: string; id: string },
  title: string,
  /** `last` takes a category from the far end of the tree, so these listings do not crowd the ones other tests look for. */
  where: "first" | "last" = "first",
) {
  const reference = (await ctx.app.inject({ method: "GET", url: "/v1/reference" })).json() as ReferenceData;
  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));
  const fits = leaves(reference.categories).filter(
    (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
  );
  const category = (where === "last" ? fits.at(-1) : fits[0]) as CategoryNode;
  const brandId = (await ctx.app.inject({ method: "GET", url: "/v1/brands?limit=1" })).json().items[0].id;
  const group = reference.sizeGroups.find((g) => category.sizeGroupIds.includes(g.id));
  photoCounter += 1;
  const res = await ctx.app.inject({
    method: "POST",
    url: "/v1/listings",
    headers: bearer(owner.token),
    payload: {
      title,
      categoryId: category.id,
      brandId,
      sizeId: group?.sizes[0]?.id,
      conditionId: reference.conditions[0]?.id,
      colourIds: [reference.colours[0]?.id],
      priceMinor: 9000,
      parcelSizeId: reference.parcelSizes[0]?.id,
      photos: [
        {
          key: `listings/${owner.id}/msg-${Date.now().toString(36)}-${photoCounter}.jpg`,
          width: 900,
          height: 1200,
        },
      ],
      publish: true,
    },
  });
  if (res.statusCode !== 201) throw new Error(`Could not publish a test listing: ${res.body}`);
  return (res.json() as { id: string }).id;
}

export type TestPerson = { token: string; id: string; username: string };

/** A short helper for calling the API as a person (or as nobody when `token` is left out). */
export function apiCaller(ctx: TestContext) {
  return (
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    token?: string,
    payload?: object,
    headers: Record<string, string> = {},
  ) =>
    ctx.app.inject({
      method,
      url,
      headers: { ...(token ? bearer(token) : {}), ...headers },
      ...(payload ? { payload } : {}),
    });
}

/** A listing in a quiet corner of the category tree. Use it in tests that publish many listings. */
export const publishQuietListing = (ctx: TestContext, owner: { token: string; id: string }, title: string) =>
  publishTestListing(ctx, owner, title, "last");
