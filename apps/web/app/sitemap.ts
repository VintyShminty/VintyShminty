import { BROWSE_MORE_TILES, BROWSE_TILES, listingCardSchema, pageSchema } from "@vinty/shared";
import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/api";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";

// Rebuilt at most once an hour, so crawlers do not make the server list thousands of items on every visit.
export const revalidate = 3600;

const MAX_ITEMS = 5000;
const PAGE_SIZE = 50;
const cardsPage = pageSchema(listingCardSchema);

/** One entry per page with its two language twins listed, as Google asks. */
function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}/en${path}`,
    lastModified,
    alternates: { languages: { en: `${SITE_URL}/en${path}`, he: `${SITE_URL}/he${path}` } },
  };
}

/** The newest active items, up to MAX_ITEMS, one page of 50 at a time. Stops quietly if the server cannot answer. */
async function newestItemIds(lang: Lang): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  try {
    while (ids.length < MAX_ITEMS) {
      const page = await serverApi(
        `/v1/listings?sort=newest&limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        { lang, schema: cardsPage, anonymous: true, revalidate: 3600 },
      );
      for (const item of page.items) if (item.status === "active") ids.push(item.id);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } catch {
    // Keep what we have.
  }
  return ids;
}

/** /sitemap.xml: Home, Browse, every Browse tile and the newest items. Each is listed in English with the Hebrew twin. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ids = await newestItemIds(LANGUAGES[0]);
  return [
    entry(""),
    entry("/browse"),
    entry("/help"),
    ...[...BROWSE_TILES, ...BROWSE_MORE_TILES].map((tile) => entry(`/browse/${tile.key}`)),
    ...ids.map((id) => entry(`/item/${id}`)),
  ];
}
