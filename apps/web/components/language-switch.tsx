"use client";

import { Globe } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANG_COOKIE, type Lang, otherLang, switchPath } from "@/lib/i18n";

/** Links to the same page in the other language and remembers the choice in the `lang` cookie. */
export function LanguageSwitch({ lang, label, title }: { lang: Lang; label: string; title: string }) {
  const pathname = usePathname();
  const to = otherLang(lang);
  return (
    <Link
      href={switchPath(pathname, to)}
      hrefLang={to}
      aria-label={title}
      title={title}
      onClick={() => {
        // biome-ignore lint/suspicious/noDocumentCookie: a plain one-line cookie, the Cookie Store API is not in every browser yet
        document.cookie = `${LANG_COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="inline-flex h-10 items-center gap-xs rounded-control px-md text-body-sm font-semibold text-text-2 hover:bg-pressed"
    >
      <Globe size={16} aria-hidden />
      {label}
    </Link>
  );
}
