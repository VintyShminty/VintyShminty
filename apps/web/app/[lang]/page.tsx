import { type HomeFeedPage, homeFeedPageSchema } from "@vinty/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeFeed } from "@/components/home-feed";
import { getViewer, serverApi } from "@/lib/api";
import { feedPath, MOODS, pagePath, parseGroup, parseMood } from "@/lib/feed-url";
import { getT, isLang } from "@/lib/i18n";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Yadii" };
  return {
    title: "Yadii",
    description: getT(lang)("web.meta.homeDescription"),
    // ?mood= and ?group= are views of the same page.
    alternates: alternatesFor(lang, ""),
  };
}

/**
 * Home (D-019 row 4, D-030): the mood chips, the Men and Women pills and the feed grid. The first page of the feed is built
 * on the server (it is in the HTML for Google), more pages load as the visitor scrolls.
 * Logged out visitors see the first three chips only, like the app: Your sizes and Near you need an account.
 */
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mood?: string | string[]; group?: string | string[] }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await getViewer(lang);

  const query = await searchParams;
  let mood = parseMood(query.mood);
  const group = parseGroup(query.group);
  if (!me && MOODS.find((m) => m.key === mood)?.needsAccount) mood = "for_you";

  const endpoint = feedPath(mood, group);
  const firstPage: HomeFeedPage | null = await serverApi(pagePath(endpoint), {
    lang,
    schema: homeFeedPageSchema,
  }).catch(() => null);

  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <HomeFeed
        lang={lang}
        initialMood={mood}
        initialGroup={group}
        firstPage={firstPage}
        city={me ? (me.profile.city?.trim() ?? null) : undefined}
      />
    </main>
  );
}
