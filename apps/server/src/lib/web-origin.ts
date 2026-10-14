import { type Env, webOrigins } from "../env.js";

/** The header the website adds when it forwards a log in call to the server (apps/web/proxy.ts). */
export const WEB_ORIGIN_HEADER = "x-vinty-web-origin";

/**
 * The address Better Auth should think a call arrived on. Normally the server's own address. When the website
 * forwarded the call it says so with a header holding its own address, and that address is used instead, so Better
 * Auth's oauth proxy (lib/auth.ts) can send Google and Apple back to the website. Only an address listed in
 * WEB_ORIGINS counts, anything else is ignored, so a made up header can pick nothing that was not already trusted.
 */
export function authRequestBase(
  env: Pick<Env, "BETTER_AUTH_URL" | "WEB_ORIGINS" | "NODE_ENV">,
  headerValue: string | string[] | undefined,
): string {
  const value = (Array.isArray(headerValue) ? headerValue[0] : headerValue)?.trim().replace(/\/$/, "");
  return value && webOrigins(env).includes(value) ? value : env.BETTER_AUTH_URL;
}
