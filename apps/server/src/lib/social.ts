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
  // Vercel keeps a multi line value on one line with \n written out, so turn those back into real line breaks.
  const pem = opts.privateKey.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
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
    clientSecret = await createAppleSecret({
      clientId,
      teamId: env.APPLE_TEAM_ID,
      keyId: env.APPLE_KEY_ID,
      privateKey: env.APPLE_PRIVATE_KEY,
    });
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
            prompt: "select_account",
          },
        }
      : {}),
    ...(on.apple ? { apple: () => appleOptions(env) } : {}),
  };
}
