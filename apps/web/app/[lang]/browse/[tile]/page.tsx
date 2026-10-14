import { BROWSE_MORE_TILES, BROWSE_TILES } from "@vinty/shared";
import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getT, isLang } from "@/lib/i18n";

// A placeholder: it shows the tile title so the links from the Browse panel work. The results page is built next.
export default async function TilePage({ params }: { params: Promise<{ lang: string; tile: string }> }) {
  const { lang, tile } = await params;
  if (!isLang(lang)) notFound();
  if (![...BROWSE_TILES, ...BROWSE_MORE_TILES].some((t) => t.key === tile)) notFound();
  const t = getT(lang);
  return <PlaceholderPage lang={lang} title={t(`browse.tiles.${tile}`)} note={t("web.tile.soon")} />;
}
