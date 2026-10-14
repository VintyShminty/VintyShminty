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

/** Any address without /en or /he in front goes to the right language: cookie, then browser language, then English. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return forwardAuth(request);
  const cookie = request.cookies.get(LANG_COOKIE)?.value;
  const lang = isLang(cookie)
    ? cookie
    : (fromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LANG);
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Log in calls, then everything except the language folders, the other forwarded server calls, Next's own files, the default link preview
  // picture and files with an extension.
  matcher: ["/api/auth/:path*", "/((?!en(?:/|$)|he(?:/|$)|api/|v1/|_next/|opengraph-image|.*\\..*).*)"],
};
