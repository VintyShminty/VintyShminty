import { HELP_ARTICLE_IDS } from "@vinty/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StillStuck } from "@/components/still-stuck";
import { getT, isLang } from "@/lib/i18n";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; topic: string }>;
}): Promise<Metadata> {
  const { lang, topic } = await params;
  if (!isLang(lang) || !HELP_ARTICLE_IDS.includes(topic)) return { title: "Vinty" };
  const t = getT(lang);
  const body = t(`help.articles.${topic}.body`);
  return {
    title: `${t(`help.articles.${topic}.title`)} | ${t("help.title")} | Vinty`,
    description: body.split("\n\n")[0],
    alternates: alternatesFor(lang, `/help/${topic}`),
  };
}

/** One Help article: a few short paragraphs (split by a blank line), then Write to us. */
export default async function HelpTopicPage({
  params,
}: {
  params: Promise<{ lang: string; topic: string }>;
}) {
  const { lang, topic } = await params;
  if (!isLang(lang) || !HELP_ARTICLE_IDS.includes(topic)) notFound();
  const t = getT(lang);
  const paragraphs = t(`help.articles.${topic}.body`).split("\n\n");
  return (
    <main className="mx-auto max-w-[760px] px-lg pb-2xl pt-xl md:px-xl">
      <nav aria-label={t("web.help.breadcrumb")} className="text-body-sm text-text-3">
        <Link href={`/${lang}/help`} className="underline underline-offset-4 hover:text-text-1">
          {t("web.help.allTopics")}
        </Link>
      </nav>
      <h1 className="mt-xs text-title font-bold text-text-1">{t(`help.articles.${topic}.title`)}</h1>
      <div className="mt-lg flex flex-col gap-md">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-body text-text-2">
            {paragraph}
          </p>
        ))}
      </div>
      <StillStuck lang={lang} outline />
    </main>
  );
}
