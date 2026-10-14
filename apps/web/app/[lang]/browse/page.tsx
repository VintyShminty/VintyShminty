import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseTiles } from "@/components/browse-tiles";
import { getT, isLang } from "@/lib/i18n";

const TILE_GRID = "grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
const TILE_SIZE = "aspect-[4/5]";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLang(lang) ? `${getT(lang)("tabs.browse")} | Vinty` : "Vinty" };
}

/** Browse: every photo tile (the first ten, then "More to explore"), each opening its results page. */
export default async function BrowsePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  return (
    <main className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
      <h1 className="text-title font-bold text-text-1">{t("tabs.browse")}</h1>
      <div className="mt-lg">
        <BrowseTiles
          lang={lang}
          className={TILE_GRID}
          tileClassName={TILE_SIZE}
          sizes="(min-width: 1024px) 20vw, 50vw"
        />
      </div>
      <h2 className="mt-2xl text-heading font-bold text-text-1">{t("browse.moreTitle")}</h2>
      <div className="mt-md">
        <BrowseTiles
          lang={lang}
          more
          className={TILE_GRID}
          tileClassName={TILE_SIZE}
          sizes="(min-width: 1024px) 20vw, 50vw"
        />
      </div>
    </main>
  );
}
