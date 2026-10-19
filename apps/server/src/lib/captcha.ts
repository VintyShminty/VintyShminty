import type { FastifyBaseLogger } from "fastify";
import type { Env } from "../env.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** What the bot check decided about one call. */
export type CaptchaVerdict = "pass" | "refuse";

export type CaptchaChecker = {
  enabled: boolean;
  check(token: string | undefined, ip: string, log: FastifyBaseLogger): Promise<CaptchaVerdict>;
};

/**
 * Cloudflare Turnstile. Off when TURNSTILE_SECRET_KEY is empty. A call without an answer passes while
 * CAPTCHA_REQUIRED is false, so app versions from before the check keep working until the new build is out. An answer
 * that Cloudflare rejects is always refused. When Cloudflare cannot be reached the call passes (logged): an outage at
 * Cloudflare must not stop every sign up, and the per address limits still apply.
 */
export function createCaptchaChecker(
  env: Pick<Env, "TURNSTILE_SECRET_KEY" | "CAPTCHA_REQUIRED">,
  fetchImpl: typeof fetch = fetch,
): CaptchaChecker {
  const secret = env.TURNSTILE_SECRET_KEY;
  return {
    enabled: Boolean(secret),
    async check(token, ip, log) {
      if (!secret) return "pass";
      if (!token) return env.CAPTCHA_REQUIRED ? "refuse" : "pass";
      try {
        const response = await fetchImpl(SITEVERIFY_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret, response: token, remoteip: ip }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`siteverify answered ${response.status}`);
        const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
        if (result.success === true) return "pass";
        log.info({ errors: result["error-codes"] }, "bot check refused");
        return "refuse";
      } catch (err) {
        log.warn({ err }, "bot check could not reach Cloudflare, letting the call through");
        return "pass";
      }
    },
  };
}
