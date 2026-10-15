import { type HomeFeedPage, homeFeedPageSchema } from "@vinty/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeFeed } from "@/components/home-feed";
import { HomeGreeting } from "@/components/home-greeting";
import { getViewer, serverApi } from "@/lib/api";
import { feedPath, MOODS, pagePath, parseMood } from "@/lib/feed-url";
import { getT, isLang } from "@/lib/i18n";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Yadii" };
  return {
    title: "Yadii",
    description: getT(lang)("web.meta.homeDescription"),
    // ?mood= is a view of the same page.
    alternates: alternatesFor(lang, ""),
  };
}

/**
 * Home (D-019 row 4, D-030): the big greeting, the mood chips and the feed grid. The first page of the feed is built
 * on the server (it is in the HTML for Google), more pages load as the visitor scrolls.
 * Logged out visitors see the first three chips only, like the app: Your sizes and Near you need an account.
 */
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mood?: string | string[] }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await getViewer(lang);

  let mood = parseMood((await searchParams).mood);
  if (!me && MOODS.find((m) => m.key === mood)?.needsAccount) mood = "for_you";

  const endpoint = feedPath(mood);
  const firstPage: HomeFeedPage | null = await serverApi(pagePath(endpoint), {
    lang,
    schema: homeFeedPageSchema,
  }).catch(() => null);

  const who = me ? me.name?.trim().split(/\s+/)[0] || me.username || null : null;

  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <HomeGreeting name={who} />
      <HomeFeed
        lang={lang}
        initialMood={mood}
        firstPage={firstPage}
        city={me ? (me.profile.city?.trim() ?? null) : undefined}
      />
    </main>
  );
}
