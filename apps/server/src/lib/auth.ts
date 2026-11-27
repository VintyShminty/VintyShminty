import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { waitUntil } from "@vercel/functions";
import {
  accounts,
  type Database,
  profiles,
  sessions,
  standInSellers,
  userSettings,
  users,
  verifications,
} from "@vinty/db";
import {
  LOCALES,
  type Locale,
  OTP_LENGTH,
  PASSWORD_MAX,
  PASSWORD_MIN,
  STAND_IN_EMAIL_DOMAIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@vinty/shared";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { admin, bearer, emailOTP, oAuthProxy, username } from "better-auth/plugins";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { type Env, webOrigins } from "../env.js";
import { runInBackground } from "./background.js";
import { type CodeEmailKind, codeEmail } from "./emails.js";
import type { Mailer } from "./mail.js";
import { buildSocialProviders, socialProvidersOn } from "./social.js";
import { isLogInPath, logInAlertText, type OwnerAlert, signInMethod, signUpAlertText } from "./telegram.js";
import { generateUsername, usernameSource } from "./username.js";

type Db = NonNullable<Database["db"]>;

/** The language for an email: the person's saved language, else the app's Accept-Language header, else English. */
export function pickLocale(
  saved: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  const first = acceptLanguage?.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return (LOCALES as readonly string[]).includes(first ?? "") ? (first as Locale) : "en";
}

/** Where Better Auth sends the browser when a social login is refused. */
export function authErrorUrl(env: Env): string {
  return `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}/v1/auth/error`;
}

export type AuthDeps = { env: Env; db: Db; mailer: Mailer; ownerAlert?: OwnerAlert };

/** A log in this soon after the account was made is the sign up's own, which already sent its alert. */
const SIGN_UP_GRACE_MS = 2 * 60 * 1000;

/**
 * Better Auth, wired to our tables.
 * - Tables are plural (users, sessions...) and ids are database UUIDs (see docs/blueprint/data-model.md).
 * - Email and password, plus a username. Codes (6 digits) by email do password reset, email confirmation and
 *   email change, because a code can be typed on the phone without a deep link round trip.
 * - Google and Apple switch on when their settings are in the environment (lib/social.ts). Apple signs in on the
 *   phone with an ID token whose audience is the app's bundle id. Google opens the browser (redirect flow) with the
 *   web client. Both give a verified email, so no confirmation code is asked.
 */
export function createAuth({ env, db, mailer, ownerAlert }: AuthDeps) {
  const { apple: appleOn } = socialProvidersOn(env);
  const dev = env.NODE_ENV !== "production";

  const sendCode = async (
    email: string,
    kind: CodeEmailKind,
    code: string,
    acceptLanguage: string | null | undefined,
  ) => {
    // A stand-in seller (admin panel, listing upload) has an address that can never receive mail. Nothing to send.
    if (email.toLowerCase().endsWith(`@${STAND_IN_EMAIL_DOMAIN}`)) return;
    const [row] = await db
      .select({ language: userSettings.language })
      .from(users)
      .innerJoin(userSettings, eq(userSettings.userId, users.id))
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    await mailer.send(codeEmail(email, kind, code, pickLocale(row?.language, acceptLanguage)));
  };

  /** The provider of the person's most recently used Google or Apple account, if any. */
  const lastSocialProvider = async (userId: string) => {
    const [row] = await db
      .select({ providerId: accounts.providerId })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), ne(accounts.providerId, "credential")))
      .orderBy(desc(accounts.updatedAt))
      .limit(1);
    return row?.providerId;
  };

  /** Telegram note to the owner (lib/telegram.ts). Runs after the response, so it never slows a sign up or log in. */
  const alertOwner = (makeText: () => Promise<string | null>) => {
    if (!ownerAlert) return;
    runInBackground(makeText().then((text) => (text ? ownerAlert(text) : undefined)));
  };

  return betterAuth({
    appName: "Basta",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    trustedOrigins: [
      `${env.APP_SCHEME}://`,
      `${env.APP_SCHEME}://*`,
      ...(dev ? ["exp://", "exp://**"] : []),
      ...(appleOn ? ["https://appleid.apple.com"] : []),
      // The website calls /api/auth through its own address (docs/plans/website.md, W1).
      ...webOrigins(env),
    ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
    },
    socialProviders: buildSocialProviders(env),
    // A refused Google or Apple login lands on a friendly page (routes/auth-error.ts) instead of a bare "Not found".
    // Better Auth adds ?error=<code> (and sometimes &error_description=...) to this address.
    onAPIError: { errorURL: authErrorUrl(env) },
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "apple"] } },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    // Better Auth's own limiter (per IP and path). The stricter per route limits sit in plugins/auth.ts.
    rateLimit: { enabled: env.NODE_ENV !== "test", window: 60, max: 100 },
    hooks: {
      // The app sends no name at sign up. The sign up route insists on one, so give it an empty one and let
      // the user hook above fill it with the username.
      before: createAuthMiddleware(async (ctx) => {
        const body = ctx.body as { name?: unknown } | undefined;
        if (ctx.path === "/sign-up/email" && body && typeof body.name !== "string") {
          body.name = "";
        }
      }),
    },
    databaseHooks: {
      // Nobody can sign in as a stand-in seller, by any route. They have no password and no sign in method, and this
      // refuses a session for them even if one were ever tried (a code sent to the unreachable address, a link).
      session: {
        create: {
          before: async (session) => {
            const [standIn] = await db
              .select({ id: standInSellers.userId })
              .from(standInSellers)
              .where(eq(standInSellers.userId, session.userId))
              .limit(1);
            return standIn ? false : { data: session };
          },
          // Owner alert for a log in. Only for real log in addresses (not a password change or an admin viewing as
          // someone), and not for the log in that comes with a new account (the sign up alert covers it).
          after: async (session, ctx) => {
            if ((session as { impersonatedBy?: string | null }).impersonatedBy) return;
            const path = ctx?.path;
            if (!isLogInPath(path)) return;
            alertOwner(async () => {
              const [user] = await db
                .select({ username: users.username, name: users.name, createdAt: users.createdAt })
                .from(users)
                .where(eq(users.id, session.userId))
                .limit(1);
              if (!user || Date.now() - user.createdAt.getTime() < SIGN_UP_GRACE_MS) return null;
              const method = signInMethod(path, await lastSocialProvider(session.userId));
              return logInAlertText(user.username ?? user.name, method);
            });
          },
        },
      },
      // Owner alert for a new account. It hangs on the sign in method being saved (not on the user) because only then
      // is it known whether this was email, Google or Apple. A Google or Apple account added later by an existing person
      // is not a sign up, so only a new person's first sign in method counts.
      account: {
        create: {
          after: async (account) => {
            alertOwner(async () => {
              const [user] = await db
                .select({
                  username: users.username,
                  name: users.name,
                  email: users.email,
                  createdAt: users.createdAt,
                })
                .from(users)
                .where(eq(users.id, account.userId))
                .limit(1);
              if (!user || Date.now() - user.createdAt.getTime() > SIGN_UP_GRACE_MS) return null;
              // Stand-in sellers made in the admin pages are not real sign ups.
              if (user.email.endsWith(`@${STAND_IN_EMAIL_DOMAIN}`)) return null;
              const [{ count } = { count: 0 }] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(accounts)
                .where(eq(accounts.userId, account.userId));
              if (count > 1) return null;
              const method = signInMethod(
                undefined,
                account.providerId === "credential" ? undefined : account.providerId,
              );
              return signUpAlertText(user.username ?? user.name, method);
            });
          },
        },
      },
      user: {
        create: {
          // Sign up asks only for email and password (D-020). Everyone still needs a public username, so one is
          // made from the email and the person can change it in Edit profile. This runs for every way of
          // creating an account. The username plugin's own hook then normalises it and fills displayUsername.
          before: async (user) => {
            const hasUsername = typeof user.username === "string" && user.username.length > 0;
            const username = hasUsername
              ? (user.username as string)
              : await generateUsername(usernameSource(user.email, user.name), async (candidate) => {
                  const [row] = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(sql`lower(${users.username}) = ${candidate.toLowerCase()}`)
                    .limit(1);
                  return Boolean(row);
                });
            const name = typeof user.name === "string" && user.name.trim() ? user.name : username;
            return {
              data: { ...user, name, ...(hasUsername ? {} : { username, displayUsername: username }) },
            };
          },
          // Every user gets a profile and a settings row, in the language the app was using.
          after: async (user, ctx) => {
            const headers = ctx?.request?.headers ?? ctx?.headers;
            const language = pickLocale(null, headers?.get("accept-language") ?? null);
            await db.insert(profiles).values({ userId: user.id }).onConflictDoNothing();
            await db.insert(userSettings).values({ userId: user.id, language }).onConflictDoNothing();
          },
        },
      },
    },
    plugins: [
      username({ minUsernameLength: USERNAME_MIN, maxUsernameLength: USERNAME_MAX }),
      bearer(),
      admin({ defaultRole: "user" }),
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendVerificationOnSignUp: true,
        changeEmail: { enabled: true },
        async sendVerificationOTP({ email, otp, type }, ctx) {
          const language =
            ctx?.request?.headers.get("accept-language") ?? ctx?.headers?.get("accept-language");
          // Not awaited on purpose: waiting would let timing reveal whether an email has an account.
          // waitUntil keeps Vercel running until the email is handed over, after the response has gone.
          waitUntil(
            sendCode(email, type, otp, language).catch((err) => {
              ctx?.context.logger.error("Could not send a code email", err);
            }),
          );
        },
      }),
      expo(),
      // Google and Apple only know the server's address as the place to come back to. When the website starts a login
      // (the call arrives on the website's address, plugins/auth.ts), this plugin sends the person back to the
      // website after the server has checked the answer, and the website's own address then sets the login cookie.
      // The phone app calls the server directly, so for it nothing changes.
      oAuthProxy({ productionURL: env.BETTER_AUTH_URL }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
