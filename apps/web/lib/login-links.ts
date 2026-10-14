/** Only same-site paths count as a place to come back to, never another website. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next?.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}

const withNext = (path: string, next: string | null | undefined) => {
  const safe = safeNext(next);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
};

/** `/en/log-in?next=/en/item/123`. `next` is where to land after logging in. */
export const loginHref = (lang: string, next?: string | null) => withNext(`/${lang}/log-in`, next);

/** `/en/sign-up?next=/en/item/123`. */
export const signUpHref = (lang: string, next?: string | null) => withNext(`/${lang}/sign-up`, next);
