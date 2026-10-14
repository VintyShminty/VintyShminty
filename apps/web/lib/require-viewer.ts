import { redirect } from "next/navigation";
import { getViewer } from "@/lib/api";
import type { Lang } from "@/lib/i18n";
import { loginHref } from "@/lib/login-links";

/**
 * For server pages that need a logged in person: returns who it is, or sends a visitor to the log in page with
 * `next` set to this page, so they come back here afterwards. `path` is the page's own path with the language,
 * for example `/en/profile`.
 */
export async function requireViewer(lang: Lang, path: string) {
  const me = await getViewer(lang);
  if (!me) redirect(loginHref(lang, path));
  return me;
}
