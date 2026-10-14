import { type HomeFeedPage, homeFeedPageSchema, personalisationSizesSchema } from "@vinty/shared";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { HomeGreeting } from "@/components/home-greeting";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { MoodChips } from "@/components/mood-chips";
import { getViewer, serverApi } from "@/lib/api";
import { feedPath, MOODS, pagePath, parseMood } from "@/lib/feed-url";
import { homeEmptyText } from "@/lib/home-empty";
import { getT, isLang } from "@/lib/i18n";

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
  const t = getT(lang);
  const me = await getViewer(lang);

  let mood = parseMood((await searchParams).mood);
  if (!me && MOODS.find((m) => m.key === mood)?.needsAccount) mood = "for_you";

  const endpoint = feedPath(mood);
  const firstPage: HomeFeedPage | null = await serverApi(pagePath(endpoint), {
    lang,
    schema: homeFeedPageSchema,
  }).catch(() => null);

  // Only an empty "Your sizes" list needs to know whether sizes are set (the note differs).
  let hasSizes: boolean | undefined;
  if (me && mood === "your_sizes" && firstPage?.items.length === 0) {
    hasSizes = await serverApi("/v1/me/personalisation/sizes", { lang, schema: personalisationSizesSchema })
      .then((s) => s.sizeIds.length > 0)
      .catch(() => undefined);
  }
  const empty = homeEmptyText(mood, t, {
    hasSizes,
    city: me ? (me.profile.city?.trim() ?? null) : undefined,
  });

  const who = me ? me.name?.trim().split(/\s+/)[0] || me.username || null : null;

  return (
    <main className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
      <HomeGreeting name={who} />
      <div className="mb-xl mt-lg">
        <MoodChips lang={lang} active={mood} signedIn={Boolean(me)} />
      </div>
      <InfiniteItemGrid
        key={endpoint}
        endpoint={endpoint}
        kind="feed"
        firstPage={firstPage}
        empty={<EmptyState title={empty.title} message={empty.message} />}
      />
    </main>
  );
}
