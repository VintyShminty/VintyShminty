import { profiles, sessions, userSettings, users } from "@vinty/db";
import { USERNAME_MAX, usernameSchema } from "@vinty/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  latestCode,
  newPerson,
  type TestContext,
  waitFor,
} from "../test-helpers.js";

// Runs only when DATABASE_URL points at a migrated local database (CI has none, so it is skipped there).
describe.skipIf(!databaseUrl)("accounts", () => {
  let ctx: TestContext;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ctx = await buildTestApp();
  });
  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  async function signUp(person = newPerson(), language = "en") {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { "accept-language": language },
      payload: {
        email: person.email,
        password: person.password,
        name: person.username,
        username: person.username,
      },
    });
    const body = res.json();
    if (body?.user?.id) createdIds.push(body.user.id);
    return { res, body, person, token: res.headers["set-auth-token"] as string | undefined };
  }
  const bearer = (token?: string) => ({ authorization: `Bearer ${token}` });

  describe("sign up and log in", () => {
    it("signs up, creates the profile and settings, and sends a confirmation code", async () => {
      const { res, body, person, token } = await signUp(newPerson("signup"), "he");
      expect(res.statusCode).toBe(200);
      expect(token).toBeTruthy();

      const [profile] = await ctx.database.db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, body.user.id));
      expect(profile).toBeTruthy();
      const [settings] = await ctx.database.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, body.user.id));
      expect(settings?.language).toBe("he");

      const code = await latestCode(ctx.mailer, person.email);
      expect(code).toMatch(/^\d{6}$/);

      const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(token) });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toMatchObject({
        email: person.email,
        username: person.username,
        needsOnboarding: false,
      });
    });

    async function signUpEmailOnly(email: string) {
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: { email, password: "correct-horse-battery", name: "" },
      });
      const body = res.json();
      if (body?.user?.id) createdIds.push(body.user.id);
      return { res, body, token: res.headers["set-auth-token"] as string | undefined };
    }

    it("signs up with only email and password and gets a valid, unique username", async () => {
      const stamp = Date.now().toString(36);
      const local = `Vt-Only.${stamp}`;
      const first = await signUpEmailOnly(`${local}@test.invalid`);
      expect(first.res.statusCode).toBe(200);
      const second = await signUpEmailOnly(`${local}@other.test.invalid`);
      expect(second.res.statusCode).toBe(200);

      const a = first.body.user;
      const b = second.body.user;
      expect(a.username).toBe(`vt-only.${stamp}`.replace("-", ""));
      expect(a.displayUsername).toBe(a.username);
      expect(a.name).toBe(a.username);
      expect(b.username).not.toBe(a.username);
      expect(b.username.startsWith(a.username.slice(0, 10))).toBe(true);
      expect(usernameSchema.safeParse(b.username).success).toBe(true);
      expect(b.username.length).toBeLessThanOrEqual(USERNAME_MAX);

      const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(first.token) });
      expect(me.json()).toMatchObject({ username: a.username, needsOnboarding: false });
    });

    it("signs up without a name field at all", async () => {
      const email = `vt-noname-${Date.now().toString(36)}@test.invalid`;
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: { email, password: "correct-horse-battery" },
      });
      if (res.json()?.user?.id) createdIds.push(res.json().user.id);
      expect(res.statusCode).toBe(200);
      expect(res.json().user.username).toBeTruthy();
    });

    it("still refuses a username that is taken when one is sent", async () => {
      const taken = await signUp(newPerson("taken"));
      const other = newPerson("taken2");
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: { email: other.email, password: other.password, name: "x", username: taken.person.username },
      });
      expect(res.statusCode).toBe(400);
    });

    it("confirms the email with the code", async () => {
      const { person, token } = await signUp(newPerson("verify"));
      const code = await latestCode(ctx.mailer, person.email);
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/email-otp/verify-email",
        payload: { email: person.email, otp: code },
      });
      expect(res.statusCode).toBe(200);
      const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(token) });
      expect(me.json().emailVerified).toBe(true);
    });

    it("refuses a username that is taken, whatever the capitals", async () => {
      const first = await signUp(newPerson("dup"));
      const second = newPerson("dup2");
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: {
          email: second.email,
          password: second.password,
          name: "x",
          username: first.person.username.toUpperCase(),
        },
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.statusCode).toBeLessThan(500);
    });

    it("refuses a password that is too short", async () => {
      const person = newPerson("weak");
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: { email: person.email, password: "short", name: "x", username: person.username },
      });
      expect(res.statusCode).toBe(400);
    });

    it("logs in with the right password", async () => {
      const { person } = await signUp(newPerson("login"));
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: person.email, password: person.password },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["set-auth-token"]).toBeTruthy();
    });

    it("rejects a wrong password with 401", async () => {
      const { person } = await signUp(newPerson("wrong"));
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: person.email, password: "not-the-password" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.headers["set-auth-token"]).toBeUndefined();
    });

    it("answers 401 in the shared error shape without a session", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/v1/me" });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: { code: "unauthenticated", message: "Please log in" } });
    });

    it("signs out and the token stops working", async () => {
      const { token } = await signUp(newPerson("out"));
      const out = await ctx.app.inject({ method: "POST", url: "/api/auth/sign-out", headers: bearer(token) });
      expect(out.statusCode).toBe(200);
      const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(token) });
      expect(me.statusCode).toBe(401);
    });
  });

  describe("password", () => {
    it("changes the password and keeps the old one from working", async () => {
      const { person, token } = await signUp(newPerson("change"));
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/change-password",
        headers: bearer(token),
        payload: {
          currentPassword: person.password,
          newPassword: "a-brand-new-password",
          revokeOtherSessions: true,
        },
      });
      expect(res.statusCode).toBe(200);
      const old = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: person.email, password: person.password },
      });
      expect(old.statusCode).toBe(401);
      const fresh = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: person.email, password: "a-brand-new-password" },
      });
      expect(fresh.statusCode).toBe(200);
    });

    it("resets a forgotten password with the emailed code", async () => {
      const { person } = await signUp(newPerson("reset"));
      const request = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/email-otp/request-password-reset",
        headers: { "accept-language": "en" },
        payload: { email: person.email },
      });
      expect(request.statusCode).toBe(200);
      // The first email is the sign up confirmation, the second is the reset code.
      const code = await latestCode(ctx.mailer, person.email, 1);

      const wrong = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/email-otp/reset-password",
        payload: {
          email: person.email,
          otp: code === "000000" ? "111111" : "000000",
          password: "another-fine-password",
        },
      });
      expect(wrong.statusCode).toBeGreaterThanOrEqual(400);

      const ok = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/email-otp/reset-password",
        payload: { email: person.email, otp: code, password: "another-fine-password" },
      });
      expect(ok.statusCode).toBe(200);
      const login = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: person.email, password: "another-fine-password" },
      });
      expect(login.statusCode).toBe(200);
    });

    it("sends the reset email in Hebrew for a Hebrew speaker", async () => {
      const { person } = await signUp(newPerson("hebrew"), "he");
      await ctx.app.inject({
        method: "POST",
        url: "/api/auth/email-otp/request-password-reset",
        payload: { email: person.email },
      });
      const mail = await waitFor(() => ctx.mailer.outbox.filter((m) => m.to === person.email)[1]);
      expect(mail.html).toContain('dir="rtl"');
      expect(mail.subject).toContain("Vinty");
    });

    it("allows 5 reset codes an hour for one email, then answers 429", async () => {
      const { person } = await signUp(newPerson("limit"));
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await ctx.app.inject({
          method: "POST",
          url: "/api/auth/email-otp/request-password-reset",
          payload: { email: person.email },
        });
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
      expect(statuses[5]).toBe(429);
    });
  });

  describe("rate limit", () => {
    it("answers 429 with the shared error shape after too many log in attempts", async () => {
      const limited = await buildTestApp({ AUTH_RATE_LIMIT_MAX: "3" });
      try {
        const attempt = () =>
          limited.app.inject({
            method: "POST",
            url: "/api/auth/sign-in/email",
            payload: { email: "nobody@test.invalid", password: "whatever-it-is" },
          });
        const first = await Promise.all([attempt(), attempt(), attempt()]);
        expect(first.map((r) => r.statusCode)).toEqual([401, 401, 401]);
        const blocked = await attempt();
        expect(blocked.statusCode).toBe(429);
        expect(blocked.json().error.code).toBe("rate_limited");
        expect(blocked.headers["retry-after"]).toBeTruthy();
      } finally {
        await limited.close();
      }
    });

    it("does not count reading the session against the strict limit", async () => {
      const limited = await buildTestApp({ AUTH_RATE_LIMIT_MAX: "2" });
      try {
        for (let i = 0; i < 6; i++) {
          const res = await limited.app.inject({ method: "GET", url: "/api/auth/get-session" });
          expect(res.statusCode).toBe(200);
        }
      } finally {
        await limited.close();
      }
    });
  });

  describe("profile and settings", () => {
    it("updates the profile and returns it", async () => {
      const { token, person } = await signUp(newPerson("prof"));
      const res = await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/profile",
        headers: bearer(token),
        payload: { name: "Dana Cohen", bio: "  Vintage lover ", city: "Haifa" },
      });
      expect(res.statusCode).toBe(200);
      const me = res.json();
      expect(me.name).toBe("Dana Cohen");
      expect(me.profile).toMatchObject({ bio: "Vintage lover", city: "Haifa", username: person.username });
    });

    it("changes the username and refuses one that is taken", async () => {
      const a = await signUp(newPerson("ua"));
      const b = await signUp(newPerson("ub"));
      const clash = await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/profile",
        headers: bearer(b.token),
        payload: { username: a.person.username.toUpperCase() },
      });
      expect(clash.statusCode).toBe(409);
      expect(clash.json().error.fields.username).toBe("validation.username.taken");

      const fresh = `Brand_New_${Date.now().toString(36)}`.slice(0, 24);
      const ok = await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/profile",
        headers: bearer(b.token),
        payload: { username: fresh },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().username).toBe(fresh);
    });

    it("rejects invalid profile input with field messages", async () => {
      const { token } = await signUp(newPerson("bad"));
      const res = await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/profile",
        headers: bearer(token),
        payload: { bio: "x".repeat(501), username: "no spaces allowed" },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe("validation_failed");
      expect(body.error.fields.bio).toBe("validation.bio.tooLong");
      expect(body.error.fields.username).toBe("validation.username.characters");
    });

    it("only accepts an avatar key from the person's own upload folder", async () => {
      const { token } = await signUp(newPerson("av"));
      const res = await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/profile",
        headers: bearer(token),
        payload: { avatarKey: "avatars/someone-else/pic.jpg" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("hands out an upload address under the person's own folder and sets the avatar", async () => {
      const { token, body } = await signUp(newPerson("up"));
      const up = await ctx.app.inject({
        method: "POST",
        url: "/v1/uploads",
        headers: bearer(token),
        payload: { purpose: "avatar", contentType: "image/jpeg", byteSize: 2048 },
      });
      expect(up.statusCode).toBe(200);
      const upload = up.json();
      expect(upload.key.startsWith(`avatars/${body.user.id}/`)).toBe(true);

      const set = await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/profile",
        headers: bearer(token),
        payload: { avatarKey: upload.key },
      });
      expect(set.statusCode).toBe(200);
      expect(set.json().profile.avatarUrl).toBe(upload.publicUrl);
    });

    it("refuses an avatar that is too big and uploads without a session", async () => {
      const { token } = await signUp(newPerson("big"));
      const big = await ctx.app.inject({
        method: "POST",
        url: "/v1/uploads",
        headers: bearer(token),
        payload: { purpose: "avatar", contentType: "image/jpeg", byteSize: 9_000_000 },
      });
      expect(big.statusCode).toBe(400);
      const anon = await ctx.app.inject({
        method: "POST",
        url: "/v1/uploads",
        payload: { purpose: "avatar", contentType: "image/jpeg", byteSize: 100 },
      });
      expect(anon.statusCode).toBe(401);
    });

    it("saves settings and notification preferences with defaults filled in", async () => {
      const { token } = await signUp(newPerson("set"));
      const patch = await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/settings",
        headers: bearer(token),
        payload: { language: "en", pushDailyLimit: 10, showLastSeen: false },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json()).toMatchObject({ language: "en", pushDailyLimit: 10, showLastSeen: false });

      const before = await ctx.app.inject({
        method: "GET",
        url: "/v1/me/notification-preferences",
        headers: bearer(token),
      });
      const list = before.json() as { type: string; channel: string; enabled: boolean }[];
      expect(list.length).toBe(24 * 2);
      expect(list.every((p) => p.enabled)).toBe(true);

      const put = await ctx.app.inject({
        method: "PUT",
        url: "/v1/me/notification-preferences",
        headers: bearer(token),
        payload: { preferences: [{ type: "new_message", channel: "push", enabled: false }] },
      });
      expect(put.statusCode).toBe(200);
      const after = put.json() as typeof list;
      expect(after.find((p) => p.type === "new_message" && p.channel === "push")?.enabled).toBe(false);
      expect(after.find((p) => p.type === "new_message" && p.channel === "email")?.enabled).toBe(true);
    });
  });

  describe("sessions", () => {
    it("lists devices and signs the others out", async () => {
      const { person, token } = await signUp(newPerson("sess"));
      const second = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { "user-agent": "Vinty/1.0 (iPad; iOS 26)" },
        payload: { email: person.email, password: person.password },
      });
      const secondToken = second.headers["set-auth-token"] as string;

      const list = await ctx.app.inject({
        method: "GET",
        url: "/api/auth/list-sessions",
        headers: bearer(token),
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toHaveLength(2);

      const revoke = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/revoke-other-sessions",
        headers: bearer(token),
      });
      expect(revoke.statusCode).toBe(200);

      expect(
        (await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(secondToken) })).statusCode,
      ).toBe(401);
      expect(
        (await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(token) })).statusCode,
      ).toBe(200);
    });
  });

  describe("delete account", () => {
    it("asks for the password first", async () => {
      const { token } = await signUp(newPerson("delpw"));
      const none = await ctx.app.inject({ method: "DELETE", url: "/v1/me", headers: bearer(token) });
      expect(none.statusCode).toBe(400);
      const wrong = await ctx.app.inject({
        method: "DELETE",
        url: "/v1/me",
        headers: { ...bearer(token), "content-type": "application/json" },
        payload: { password: "definitely-wrong" },
      });
      expect(wrong.statusCode).toBe(403);
      expect(
        (await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(token) })).statusCode,
      ).toBe(200);
    });

    it("closes the account and clears every personal field", async () => {
      const { person, token, body } = await signUp(newPerson("del"));
      await ctx.app.inject({
        method: "PATCH",
        url: "/v1/me/profile",
        headers: bearer(token),
        payload: { bio: "Something personal", city: "Haifa", name: "Dana Cohen" },
      });
      const res = await ctx.app.inject({
        method: "DELETE",
        url: "/v1/me",
        headers: { ...bearer(token), "content-type": "application/json" },
        payload: { password: person.password },
      });
      expect(res.statusCode).toBe(204);

      const [user] = await ctx.database.db.select().from(users).where(eq(users.id, body.user.id));
      expect(user).toBeTruthy(); // the row stays so orders and reviews keep their history
      expect(user?.name).toBe("Deleted member");
      expect(user?.username).toBeNull();
      expect(user?.displayUsername).toBeNull();
      expect(user?.email).not.toBe(person.email);
      expect(user?.email).toContain("@deleted.invalid");

      const [profile] = await ctx.database.db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, body.user.id));
      expect(profile).toMatchObject({ bio: null, city: null, avatarKey: null });
      expect(profile?.deletedAt).toBeInstanceOf(Date);
      expect(
        await ctx.database.db.select().from(sessions).where(eq(sessions.userId, body.user.id)),
      ).toHaveLength(0);

      // Cannot log in any more, the old token is dead, the public profile is gone.
      const login = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: person.email, password: person.password },
      });
      expect(login.statusCode).toBe(401);
      expect(
        (await ctx.app.inject({ method: "GET", url: "/v1/me", headers: bearer(token) })).statusCode,
      ).toBe(401);
      expect((await ctx.app.inject({ method: "GET", url: `/v1/users/${body.user.id}` })).statusCode).toBe(
        404,
      );
    });

    it("lets the same username and email be used again", async () => {
      const person = newPerson("again");
      const first = await signUp(person);
      await ctx.app.inject({
        method: "DELETE",
        url: "/v1/me",
        headers: { ...bearer(first.token), "content-type": "application/json" },
        payload: { password: person.password },
      });
      const again = await signUp(person);
      expect(again.res.statusCode).toBe(200);
    });
  });

  describe("public profile", () => {
    it("shows a seeded member's listings and reviews", async () => {
      const [seeded] = await ctx.database.db.select().from(users).where(eq(users.username, "oliver.smith"));
      if (!seeded) return; // the sample data is not loaded in this database
      const profile = await ctx.app.inject({ method: "GET", url: `/v1/users/${seeded.id}` });
      expect(profile.statusCode).toBe(200);
      expect(profile.json().username).toBe("oliver.smith");

      const active = await ctx.app.inject({ method: "GET", url: `/v1/users/${seeded.id}/listings?limit=5` });
      expect(active.statusCode).toBe(200);
      const page = active.json();
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items[0].cover.url).toContain("seed/listings/");

      const reviews = await ctx.app.inject({ method: "GET", url: `/v1/users/${seeded.id}/reviews` });
      expect(reviews.statusCode).toBe(200);
      expect(reviews.json().items.length).toBeGreaterThan(0);
      expect(reviews.json().summary.total).toBeGreaterThan(0);
    });

    it("answers 404 for an unknown member", async () => {
      const res = await ctx.app.inject({
        method: "GET",
        url: "/v1/users/6f1c1c1e-5c1d-4d52-9f4a-111111111111",
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("not_found");
    });
  });
});
