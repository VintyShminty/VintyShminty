import {
  BROWSE_MORE_PHOTO,
  BROWSE_MORE_TILES,
  BROWSE_TILES,
  type BrowseGender,
  type BrowseTile,
  browseTilesFor,
  type CategoryNode,
  searchPageSchema,
  tileCategoryIds,
} from "@vinty/shared";
import { PhotoTile } from "@/components/photo-tile";
import { serverApi } from "@/lib/api";
import { getT, type Lang } from "@/lib/i18n";
import { getReference } from "@/lib/reference";
import { cn } from "@/lib/utils";

/**
 * The covers of the newest active listings in the given categories (card-sized, they come ready sized from the server).
 * Asked anonymously and kept for five minutes, so the pictures follow the listings without a call per page view.
 * Empty when there is no such listing (the tile then shows its fallback photo). A few are asked for so that two tiles
 * covering the same items (Sneakers and Shoes) can each take a different one.
 */
async function coversOf(lang: Lang, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const page = await serverApi(`/v1/listings?sort=newest&categoryIds=${ids.join(",")}&limit=6`, {
    lang,
    schema: searchPageSchema,
    anonymous: true,
    revalidate: 300,
  }).catch(() => null);
  return (page?.items ?? []).flatMap((item) => (item.cover ? [item.cover.url] : []));
}

/**
 * The photo tiles of D-019 row 5, each linking to `/[lang]/browse/[tileKey]`. A server component, so the links are
 * in the page for Google. Each tile shows the cover of the newest active listing in its categories (D-052) and
 * falls back to a stock photo when it has none, so no tile is ever blank. `withMore` adds the "More" tile that opens
 * `/[lang]/browse`. `more` shows the tiles behind More instead of the first ten (the Browse page lists both).
 * `gender` shows that side's tiles (the Browse panel's Women and Men), looking only at that side's listings and
 * opening the tile page on the same side. `tileClassName` sets the size of each tile, `className` the grid around them.
 */
export async function BrowseTiles({
  lang,
  more = false,
  withMore = false,
  gender,
  className,
  tileClassName = "h-[120px]",
  sizes,
}: {
  lang: Lang;
  more?: boolean;
  withMore?: boolean;
  gender?: BrowseGender;
  className?: string;
  tileClassName?: string;
  sizes?: string;
}) {
  const t = getT(lang);
  const tiles: BrowseTile[] = gender ? browseTilesFor(gender) : more ? BROWSE_MORE_TILES : BROWSE_TILES;
  const tree: readonly CategoryNode[] = (await getReference(lang).catch(() => null))?.categories ?? [];
  const options = await Promise.all(tiles.map((tile) => coversOf(lang, tileCategoryIds(tree, tile, gender))));
  // Each tile takes its newest cover that no tile before it already shows.
  const taken = new Set<string>();
  const covers = options.map((urls) => {
    const url = urls.find((u) => !taken.has(u)) ?? null;
    if (url) taken.add(url);
    return url;
  });
  const query = gender ? `?group=${gender}` : "";
  return (
    <div className={cn("grid gap-md", className)}>
      {tiles.map((tile, i) => (
        <PhotoTile
          key={tile.key}
          href={`/${lang}/browse/${tile.key}${query}`}
          label={t(`browse.tiles.${tile.key}`)}
          photo={covers[i] ? undefined : tile.photo}
          imageUrl={covers[i] ?? undefined}
          sizes={sizes}
          className={tileClassName}
        />
      ))}
      {withMore ? (
        <PhotoTile
          href={`/${lang}/browse`}
          label={t("browse.more")}
          accessibleName={t("browse.moreTitle")}
          photo={BROWSE_MORE_PHOTO}
          sizes={sizes}
          className={tileClassName}
        />
      ) : null}
    </div>
  );
}
