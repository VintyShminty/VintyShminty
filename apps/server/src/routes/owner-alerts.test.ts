import { accounts, users } from "@vinty/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { settleBackground } from "../lib/background.js";
import { buildTestApp, cleanupTestUsers, databaseUrl, newPerson, type TestContext } from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated local database (CI has none, so it is skipped there).
describe.skipIf(!databaseUrl)("owner alerts on Telegram", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];
  const sent: string[] = [];
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith("https://api.telegram.org/")) {
        sent.push(JSON.parse(String(init?.body)).text);
        return new Response("{}", { status: 200 });
      }
      return realFetch(url, init);
    });
    ctx = await buildTestApp({ TELEGRAM_BOT_TOKEN: "123:test", TELEGRAM_CHAT_ID: "42" });
  });
  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
    vi.unstubAllGlobals();
  });

  it("sends one alert for a sign up and one for a later log in", async () => {
    const person = newPerson("alert");
    const signUp = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email: person.email, password: person.password, username: person.username },
    });
    expect(signUp.statusCode).toBe(200);
    const userId = signUp.json().user.id as string;
    createdIds.push(userId);
    await settleBackground();
    const username = person.username.toLowerCase();
    // The sign up also logs the person in, which must not send a second alert.
    expect(sent).toEqual([`🆕 New sign up: ${username} (email and password)`]);

    // A log in some time later.
    await ctx.database.db
      .update(users)
      .set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(users.id, userId));
    const logIn = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: person.email, password: person.password },
    });
    expect(logIn.statusCode).toBe(200);
    await settleBackground();
    expect(sent).toEqual([
      `🆕 New sign up: ${username} (email and password)`,
      `🔑 Log in: ${username} (email and password)`,
    ]);

    // Someone with Google linked who logs in with the password: the alert names the password, not Google.
    await ctx.database.db.insert(accounts).values({
      userId,
      providerId: "google",
      accountId: `google-${userId}`,
    });
    const passwordAgain = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: person.email, password: person.password },
    });
    expect(passwordAgain.statusCode).toBe(200);
    await settleBackground();
    expect(sent.at(-1)).toBe(`🔑 Log in: ${username} (email and password)`);
    const token = passwordAgain.headers["set-auth-token"] as string;

    // Changing the password and logging out other devices makes a new session, but it is not a log in.
    const before = sent.length;
    const change = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        currentPassword: person.password,
        newPassword: `${person.password}x`,
        revokeOtherSessions: true,
      },
    });
    expect(change.statusCode).toBe(200);
    await settleBackground();
    expect(sent).toHaveLength(before);
  });
});
