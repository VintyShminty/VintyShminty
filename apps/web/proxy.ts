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

/** Any address without /en or /he in front goes to the right language: cookie, then browser language, then English. */
export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(LANG_COOKIE)?.value;
  const lang = isLang(cookie)
    ? cookie
    : (fromAcceptLanguage(request.headers.get("accept-language")) ?? DEFAULT_LANG);
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the language folders, the forwarded server calls, Next's own files, the default link preview
  // picture and files with an extension.
  matcher: ["/((?!en(?:/|$)|he(?:/|$)|api/|v1/|_next/|opengraph-image|.*\\..*).*)"],
};
