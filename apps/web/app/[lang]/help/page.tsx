import { HELP_ARTICLE_IDS, HELP_GROUPS } from "@vinty/shared";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpAsk } from "@/components/help-ask";
import { StillStuck } from "@/components/still-stuck";
import { getT, isLang } from "@/lib/i18n";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Vinty" };
  const t = getT(lang);
  return {
    title: `${t("help.title")} | Vinty`,
    description: t("web.help.metaDescription"),
    alternates: alternatesFor(lang, "/help"),
  };
}

/** The Help Centre: the same five groups and articles as the app (shared list, same wording), then Write to us. */
export default async function HelpPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  return (
    <main className="mx-auto max-w-[760px] px-lg pb-2xl pt-xl md:px-xl">
      <h1 className="text-title font-bold text-text-1">{t("help.title")}</h1>
      <p className="mt-sm text-body text-text-3">{t("help.intro")}</p>

      <HelpAsk
        lang={lang}
        labels={{
          title: t("help.ask.title"),
          placeholder: t("help.ask.placeholder"),
          button: t("help.ask.button"),
          thinking: t("help.ask.thinking"),
          label: t("help.ask.label"),
          readMore: t("help.ask.readMore"),
          noAnswer: t("help.ask.noAnswer"),
        }}
        titles={Object.fromEntries(HELP_ARTICLE_IDS.map((id) => [id, t(`help.articles.${id}.title`)]))}
      />

      {HELP_GROUPS.map((group) => (
        <section key={group.id} className="mt-xl">
          <h2 className="pb-xs text-section-label font-semibold uppercase tracking-wide text-text-3">
            {t(`help.groups.${group.id}`)}
          </h2>
          <ul className="border-t border-border-subtle">
            {group.articles.map((id) => (
              <li key={id} className="border-b border-border-subtle">
                <Link
                  href={`/${lang}/help/${id}`}
                  className="flex items-center justify-between gap-md py-md text-body text-text-1 hover:text-primary"
                >
                  {t(`help.articles.${id}.title`)}
                  <ChevronRight size={18} aria-hidden className="shrink-0 text-text-3 rtl:-scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <StillStuck lang={lang} />
    </main>
  );
}
