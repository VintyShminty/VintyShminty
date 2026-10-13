import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { accounts, type Database, profiles, sessions, userSettings, users, verifications } from "@vinty/db";
import {
  LOCALES,
  type Locale,
  OTP_LENGTH,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@vinty/shared";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { admin, bearer, emailOTP, username } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import type { Env } from "../env.js";
import { type CodeEmailKind, codeEmail } from "./emails.js";
import type { Mailer } from "./mail.js";
import { generateUsername } from "./username.js";

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

export type AuthDeps = { env: Env; db: Db; mailer: Mailer };

/**
 * Better Auth, wired to our tables.
 * - Tables are plural (users, sessions...) and ids are database UUIDs (see docs/blueprint/data-model.md).
 * - Email and password, plus a username. Codes (6 digits) by email do password reset, email confirmation and
 *   email change, because a code can be typed on the phone without a deep link round trip.
 * - Google and Apple are prepared and switch on when their credentials are in the environment.
 */
export function createAuth({ env, db, mailer }: AuthDeps) {
  const googleOn = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const appleOn = Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET);
  const dev = env.NODE_ENV !== "production";

  const sendCode = async (
    email: string,
    kind: CodeEmailKind,
    code: string,
    acceptLanguage: string | null | undefined,
  ) => {
    const [row] = await db
      .select({ language: userSettings.language })
      .from(users)
      .innerJoin(userSettings, eq(userSettings.userId, users.id))
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    await mailer.send(codeEmail(email, kind, code, pickLocale(row?.language, acceptLanguage)));
  };

  return betterAuth({
    appName: "Vinty",
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
    ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
    },
    socialProviders: {
      ...(googleOn
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID as string,
              clientSecret: env.GOOGLE_CLIENT_SECRET as string,
            },
          }
        : {}),
      ...(appleOn
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID as string,
              clientSecret: env.APPLE_CLIENT_SECRET as string,
              appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
            },
          }
        : {}),
    },
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "apple"] } },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    // Better Auth's own limiter (per IP and path). The stricter per route limits sit in plugins/auth.ts.
    rateLimit: { enabled: env.NODE_ENV !== "test", window: 60, max: 100 },
    hooks: {
      // The app sends no name at sign up. The sign up route insists on one, so give it an empty one and let
      // the user hook above fill it with the username.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email" && ctx.body && typeof ctx.body.name !== "string") {
          ctx.body.name = "";
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Sign up asks only for email and password (D-019). Everyone still needs a public username, so one is
          // made from the email and the person can change it in Edit profile. This runs for every way of
          // creating an account. The username plugin's own hook then normalises it and fills displayUsername.
          before: async (user) => {
            const hasUsername = typeof user.username === "string" && user.username.length > 0;
            const username = hasUsername
              ? (user.username as string)
              : await generateUsername(user.email, async (candidate) => {
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
          void sendCode(email, type, otp, language).catch((err) => {
            ctx?.context.logger.error("Could not send a code email", err);
          });
        },
      }),
      expo(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
