import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { getT, type Lang } from "@/lib/i18n";

/** A plain, short footer (brief section 2): About, Help, Terms, Privacy and the language switch. No store badges yet. */
export function Footer({ lang }: { lang: Lang }) {
  const t = getT(lang);
  const links = [
    ["about", t("web.footer.about")],
    ["help", t("web.footer.help")],
    ["terms", t("web.footer.terms")],
    ["privacy", t("web.footer.privacy")],
  ] as const;
  return (
    <footer className="mt-2xl border-t border-border">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-lg gap-y-sm px-lg py-lg text-body-sm text-text-3 md:px-xl">
        <span>{t("web.footer.rights", { year: new Date().getFullYear() })}</span>
        <nav aria-label={t("web.footer.help")} className="flex flex-wrap gap-x-lg gap-y-xs">
          {links.map(([slug, label]) => (
            <Link key={slug} href={`/${lang}/${slug}`} className="hover:text-text-1">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto">
          <LanguageSwitch
            lang={lang}
            label={t("web.nav.otherLanguage")}
            title={t("web.nav.switchLanguage")}
          />
        </div>
      </div>
    </footer>
  );
}
