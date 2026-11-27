import type { Env } from "../env.js";

type Log = { warn: (obj: object, msg: string) => void };

/** Sends one note to the owner. Never throws. */
export type OwnerAlert = (text: string) => Promise<void>;

const TIMEOUT_MS = 5000;

/**
 * A message to the owner's Telegram through a bot made with BotFather (new sign ups and log ins, lib/auth.ts). Off
 * (undefined) unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are both set, so development and tests send nothing.
 * It gives up after 5 seconds and a failure is only logged, so Telegram being down never breaks a log in. The token
 * is part of Telegram's address, so neither the address nor a raw error is ever logged. Plain text on purpose:
 * Telegram's formatting modes choke on usernames with underscores.
 */
export function telegramAlert(
  env: Pick<Env, "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID">,
  log: Log,
  fetchImpl: typeof fetch = fetch,
): OwnerAlert | undefined {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return undefined;
  return async (text) => {
    try {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        // Telegram's reason ("chat not found", "bot was blocked by the user") carries no token.
        const reply = (await res.json().catch(() => null)) as { description?: unknown } | null;
        const reason = typeof reply?.description === "string" ? reply.description : undefined;
        log.warn({ status: res.status, reason }, "Telegram refused an owner alert");
      }
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.name : "unknown" }, "Could not send an owner alert");
    }
  };
}

/**
 * True for the addresses where someone actually logs in. Other actions also make a new session (changing the password
 * with "log out other devices", an admin viewing as someone) and must not read as a log in.
 */
export function isLogInPath(path: string | undefined): boolean {
  if (!path) return false;
  return path.startsWith("/sign-in/") || path.startsWith("/callback/") || path === "/oauth-proxy-callback";
}

const EMAIL_PASSWORD_PATHS = new Set(["/sign-up/email", "/sign-in/email", "/sign-in/username"]);
const PROVIDER_NAMES: Record<string, string> = { google: "Google", apple: "Apple" };

/**
 * How someone signed up or logged in, in words. Email paths are known from the address that was called. For Google
 * and Apple the caller passes the provider of the person's most recently used social account, because the website's
 * Google and Apple logins finish on a shared address that does not name the provider.
 */
export function signInMethod(path: string | undefined, lastSocialProvider: string | undefined): string {
  if (path && EMAIL_PASSWORD_PATHS.has(path)) return "email and password";
  if (path === "/sign-in/email-otp") return "email code";
  if (lastSocialProvider) return PROVIDER_NAMES[lastSocialProvider] ?? lastSocialProvider;
  return "email and password";
}

export const signUpAlertText = (username: string, method: string) =>
  `🆕 New sign up: ${username} (${method})`;
export const logInAlertText = (username: string, method: string) => `🔑 Log in: ${username} (${method})`;
