import { importPKCS8, SignJWT } from "jose";
import type { Env } from "../env.js";

/** Which sign in providers are switched on. Apple needs the app's bundle id, Google needs its web client pair. */
export function socialProvidersOn(
  env: Pick<Env, "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "APPLE_APP_BUNDLE_IDENTIFIER">,
) {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(env.APPLE_APP_BUNDLE_IDENTIFIER),
  };
}

/**
 * The .p8 key as jose wants it, however it was pasted: with real line breaks, with \n written out (how Vercel keeps
 * a multi line value), on one line with spaces, in quotes, or without the BEGIN and END lines. Only the base64 body
 * is kept and laid out again in 64 character lines.
 */
export function normalizeApplePem(raw: string): string {
  const body = raw
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END)[^-]*-----/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}

/**
 * Apple's "client secret" is a short lived signed token made from the .p8 key. Apple refuses one that lives
 * longer than 6 months, so this makes one that lives 150 days. The phone sign in (ID token) does not use it, but
 * Apple's web flow and account deletion (revoking the link) do.
 */
export async function createAppleSecret(opts: {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}): Promise<string> {
  const key = await importPKCS8(normalizeApplePem(opts.privateKey), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: opts.keyId })
    .setIssuer(opts.teamId)
    .setSubject(opts.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 150 * 24 * 60 * 60)
    .sign(key);
}

type AppleEnv = Pick<
  Env,
  | "APPLE_CLIENT_ID"
  | "APPLE_CLIENT_SECRET"
  | "APPLE_APP_BUNDLE_IDENTIFIER"
  | "APPLE_TEAM_ID"
  | "APPLE_KEY_ID"
  | "APPLE_PRIVATE_KEY"
>;

/**
 * Apple options for Better Auth. On the phone the ID token's audience is the app's bundle id, so that is always
 * accepted. APPLE_CLIENT_ID (a Services ID) is only for a web sign in and is accepted too when set.
 * The secret comes from APPLE_CLIENT_SECRET, else is made from the key values, else stays empty (phone only).
 */
export async function appleOptions(env: AppleEnv) {
  const bundleId = env.APPLE_APP_BUNDLE_IDENTIFIER as string;
  const clientId = env.APPLE_CLIENT_ID ?? bundleId;
  let clientSecret = env.APPLE_CLIENT_SECRET ?? "";
  if (!clientSecret && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    try {
      clientSecret = await createAppleSecret({
        clientId,
        teamId: env.APPLE_TEAM_ID,
        keyId: env.APPLE_KEY_ID,
        privateKey: env.APPLE_PRIVATE_KEY,
      });
    } catch (err) {
      // A key that cannot be read must never stop the server: Better Auth builds this while starting, so a throw here
      // took every route down (2026-10-14). Without a secret the phone's Apple sign in (ID token) still works, only
      // Apple's web flow and the revoke on account deletion need it. The key itself is never logged.
      console.error(
        `Apple sign in: APPLE_PRIVATE_KEY could not be read (${err instanceof Error ? err.message : "unknown error"}). Apple on the website stays off until it is fixed.`,
      );
    }
  }
  return {
    clientId,
    clientSecret,
    appBundleIdentifier: bundleId,
    audience: [...new Set([bundleId, clientId])],
  };
}

/** The `socialProviders` block for Better Auth: only the providers whose settings are filled in. */
export function buildSocialProviders(env: Env) {
  const on = socialProvidersOn(env);
  return {
    ...(on.google
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
            // The browser sheet remembers the last Google account, so always show the chooser.
            prompt: "select_account" as const,
          },
        }
      : {}),
    ...(on.apple ? { apple: () => appleOptions(env) } : {}),
  };
}
