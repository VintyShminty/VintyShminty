import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_LANG, isLang, LANG_COOKIE, type Lang } from "@/lib/i18n";

/** The first language in Accept-Language that we offer, else null. */
function fromAcceptLanguage(header: string | null): Lang | null {
  for (const part of (header ?? "").split(",")) {
    const code = part.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
    if (code === "iw") return "he";
    if (isLang(code)) return code;
  }
  return null;
}

const API_URL = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

/**
 * Log in calls (/api/auth/...) go on to the server. The header tells the server which website address the person is
 * on, so Google and Apple can send them back here and the login cookie belongs to this address (the server only
 * believes addresses it already trusts, see apps/server/src/lib/web-origin.ts). Always set here, so a visitor cannot
 * choose it.
 */
function forwardAuth(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-vinty-web-origin", SITE_URL ?? request.nextUrl.origin);
  return NextResponse.rewrite(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, API_URL), {
    request: { headers },
  });
}

const DEV = process.env.NODE_ENV === "development";

/**
 * The browser's rule for what a page may load and run (Content Security Policy). Scripts only run when they come from
 * this website and carry this visit's random number (Next adds it to its own scripts), so a script someone sneaks into
 * a listing or message never runs. Cloudflare's bot check is loaded by our own script, which `strict-dynamic` allows.
 * No other site may show our pages inside a frame. Development adds what the hot reloading needs.
 */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${DEV ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https:${DEV ? " http:" : ""}`,
    "font-src 'self' data:",
    // The live chat connects to the server directly, photos upload straight to the storage bucket.
    `connect-src 'self' https: wss:${DEV ? " http: ws:" : ""}`,
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(DEV ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** A page in a language folder: render it with the rule above. */
function withSecurityPolicy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  // Next reads the rule from the request to find the number, and puts it on every script it writes.
  headers.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", policy);
  return response;
}

/** Any address without /en or /he in front goes to the right language: cookie, then browser language, then English. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return forwardAuth(request);
  if (isLang(request.nextUrl.pathname.split("/")[1])) return withSecurityPolicy(request);
  const cookie = request.cookies.get(LANG_COOKIE)?.value;
  const lang = isLang(cookie)
    ? cookie
    : (fromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LANG);
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Log in calls, the language folders (for the security rule), then everything else except the other forwarded server
  // calls, Next's own files, the default link preview picture, the app's bot check page (app/app-check) and files with
  // an extension.
  matcher: [
    "/api/auth/:path*",
    "/(en|he)",
    "/(en|he)/:path*",
    "/((?!en(?:/|$)|he(?:/|$)|api/|v1/|_next/|opengraph-image|app-check$|.*\\..*).*)",
  ],
};
