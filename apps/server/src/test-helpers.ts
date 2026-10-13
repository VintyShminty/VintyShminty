import { createDb, type Database, users } from "@vinty/db";
import { inArray, like, or } from "drizzle-orm";
import { buildApp } from "./app.js";
import { type Env, parseEnv } from "./env.js";
import { type MemoryMailer, memoryMailer } from "./lib/mail.js";
import type { Storage } from "./lib/storage.js";

export const databaseUrl = process.env.DATABASE_URL;

export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl ?? "postgres://test:test@localhost:5432/test",
    MAIL_TRANSPORT: "memory",
    AUTH_RATE_LIMIT_MAX: "1000",
    ...overrides,
  });
}

/** Storage that never touches the network. */
export const fakeStorage: Storage = {
  async presignUpload({ userId, purpose, contentType }) {
    const key = `${purpose === "avatar" ? "avatars" : "listings"}/${userId}/fake.${contentType.split("/")[1]}`;
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
  async remove() {},
};

export type TestContext = {
  app: Awaited<ReturnType<typeof buildApp>>;
  mailer: MemoryMailer;
  database: Database;
  close: () => Promise<void>;
};

/** Builds the real app against the local database with email kept in memory. */
export async function buildTestApp(envOverrides: Record<string, string> = {}): Promise<TestContext> {
  const env = testEnv(envOverrides);
  const database = createDb(env.DATABASE_URL);
  const mailer = memoryMailer();
  const app = await buildApp({ env, database, mailer, storage: fakeStorage });
  await app.ready();
  return { app, mailer, database, close: () => app.close() };
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
