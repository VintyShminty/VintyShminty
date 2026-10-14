import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n";

/** The public address of the website. Online it must be set to the real address (NEXT_PUBLIC_SITE_URL). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(/\/$/, "");

/**
 * The canonical address and the two language twins of a page. `path` is the part after the language, for example
 * "" (Home), "/browse" or "/item/123". Relative paths are made absolute by `metadataBase` in the language layout.
 */
export function alternatesFor(lang: Lang, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: `/${lang}${path}`,
    languages: { en: `/en${path}`, he: `/he${path}`, "x-default": `/en${path}` },
  };
}
