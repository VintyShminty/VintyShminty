import { LANGUAGES } from "./i18n";

const BASE = "https://x.invalid";
// Browsers drop tabs and line breaks from addresses, so `/<tab>/evil.com` would become `//evil.com`.
// Control characters (code 0 to 31 and 127) are checked by number, and any kind of space with \s.
const hasControlOrSpace = (text: string) =>
  /\s/.test(text) || [...text].some((c) => c.charCodeAt(0) <= 0x1f || c.charCodeAt(0) === 0x7f);

/**
 * Only same-site pages under a language (`/en/...`, `/he/...`) count as a place to come back to,
 * never another website. Anything else gives null, and callers fall back to the home page.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next?.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  if (hasControlOrSpace(next)) return null;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const inLanguage = LANGUAGES.some(
    (lang) => url.pathname === `/${lang}` || url.pathname.startsWith(`/${lang}/`),
  );
  if (!inLanguage) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

const withNext = (path: string, next: string | null | undefined) => {
  const safe = safeNext(next);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
};

/** `/en/log-in?next=/en/item/123`. `next` is where to land after logging in. */
export const loginHref = (lang: string, next?: string | null) => withNext(`/${lang}/log-in`, next);

/** `/en/sign-up?next=/en/item/123`. */
export const signUpHref = (lang: string, next?: string | null) => withNext(`/${lang}/sign-up`, next);
