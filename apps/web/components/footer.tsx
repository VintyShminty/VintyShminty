import Link from "next/link";
import { LanguageMenu } from "@/components/language-menu";
import { getT, type Lang } from "@/lib/i18n";

/** A plain, short footer (brief section 2): About, Help, Terms, Privacy and the language menu. No store badges yet. */
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
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-lg gap-y-sm px-lg py-lg text-body-sm text-text-3 md:px-xl lg:px-[48px] xl:px-[80px]">
        <span>{t("web.footer.rights", { year: new Date().getFullYear() })}</span>
        <nav aria-label={t("web.footer.help")} className="flex flex-wrap gap-x-lg gap-y-xs">
          {links.map(([slug, label]) => (
            <Link key={slug} href={`/${lang}/${slug}`} className="hover:text-text-1">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto">
          <LanguageMenu lang={lang} up />
        </div>
      </div>
    </footer>
  );
}
