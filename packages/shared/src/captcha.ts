/**
 * The bot check (Cloudflare Turnstile). The website and the app get a one time answer from Cloudflare and send it in
 * this header on the calls below. The server asks Cloudflare whether the answer is real before it lets the call in.
 */
export const CAPTCHA_HEADER = "x-captcha-response";

/** Sign up, log in, asking for an emailed code and the Help question box: the calls a bot would hammer. */
const CAPTCHA_PATHS =
  /^\/(api\/auth\/(sign-up\/email|sign-in\/(email|username)|email-otp\/(request-password-reset|send-verification-otp)|request-password-reset|forget-password\/email-otp)|v1\/help\/ask)$/;

/** True when a POST to this path needs the bot check. Takes a full address or a path, ignores the query. */
export function needsCaptcha(urlOrPath: string): boolean {
  const path = urlOrPath.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").split(/[?#]/)[0] ?? "";
  return CAPTCHA_PATHS.test(path);
}

/** Better Auth's error code for a refused bot check. The forms turn it into friendly words. */
export const CAPTCHA_FAILED_CODE = "CAPTCHA_FAILED";
