import {
  BROWSE_MORE_PHOTO,
  BROWSE_MORE_TILES,
  BROWSE_TILES,
  type BrowseGender,
  type BrowseTile,
  browseCoversSchema,
  browseRestFor,
  browseTilesFor,
  type CoverSide,
} from "@vinty/shared";
import { BrowseMoreTile } from "@/components/browse-more";
import { PhotoTile } from "@/components/photo-tile";
import { serverApi } from "@/lib/api";
import { tilePhoto } from "@/lib/browse-photos";
import { getT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The covers of the newest active listings under every tile of one side, by tile key (card-sized, they come ready
 * sized from the server). One call per side, asked anonymously and kept for five minutes, so the pictures follow the
 * listings without a call per tile or per page view. A tile with no listing gets none and shows its fallback photo.
 * A few are sent per tile so that two tiles covering the same items (Sneakers and Shoes) can each take a different one.
 */
async function coversOf(lang: Lang, side: CoverSide): Promise<Record<string, string[]>> {
  const page = await serverApi(`/v1/browse/covers?side=${side}`, {
    lang,
    schema: browseCoversSchema,
    anonymous: true,
    revalidate: 300,
  }).catch(() => null);
  return page?.covers ?? {};
}

/**
 * The photo tiles of D-019 row 5, each linking to `/[lang]/browse/[tileKey]`. A server component, so the links are
 * in the page for Google. Each tile shows the cover of the newest active listing in its categories (D-052) and
 * falls back to a stock photo when it has none, so no tile is ever blank. `withMore` adds the "More" tile that opens
 * `/[lang]/browse`. `more` shows the tiles behind More instead of the first ten (the Browse page lists both).
 * `gender` shows that side's tiles (the Browse panel's Women and Men), looking only at that side's listings and
 * opening the tile page on the same side. With `gender`, More shows small pictures of the rest and opens them inside
 * the Browse panel (D-054). `rest` lists that side's tiles behind More instead (the part that opens).
 * `tileClassName` sets the size of each tile, `className` the grid around them.
 */
export async function BrowseTiles({
  lang,
  more = false,
  withMore = false,
  gender,
  rest,
  className,
  tileClassName = "h-[120px]",
  sizes,
}: {
  lang: Lang;
  more?: boolean;
  withMore?: boolean;
  gender?: BrowseGender;
  rest?: BrowseGender;
  className?: string;
  tileClassName?: string;
  sizes?: string;
}) {
  const t = getT(lang);
  const tiles: (BrowseTile & { group?: BrowseGender })[] = rest
    ? browseRestFor(rest)
    : gender
      ? browseTilesFor(gender).map((tile) => ({ ...tile, group: gender }))
      : more
        ? BROWSE_MORE_TILES
        : BROWSE_TILES;
  const byKey = await coversOf(lang, rest ?? gender ?? "all");
  const options = tiles.map((tile) => byKey[tile.key] ?? []);
  // Each tile takes its newest cover that no tile before it already shows.
  const taken = new Set<string>();
  const covers = options.map((urls) => {
    const url = urls.find((u) => !taken.has(u)) ?? null;
    if (url) taken.add(url);
    return url;
  });
  const behindMore = gender ? browseRestFor(gender) : [];
  const previews = behindMore.flatMap((tile) => {
    const image = tilePhoto(tile.photo);
    return image ? [image] : [];
  });
  return (
    <div className={cn("grid gap-md", className)}>
      {tiles.map((tile, i) => (
        <PhotoTile
          key={tile.key}
          href={`/${lang}/browse/${tile.key}${tile.group ? `?group=${tile.group}` : ""}`}
          label={t(`browse.tiles.${tile.key}`)}
          photo={covers[i] ? undefined : tile.photo}
          imageUrl={covers[i] ?? undefined}
          sizes={sizes}
          className={tileClassName}
        />
      ))}
      {withMore && gender ? (
        <BrowseMoreTile
          href={`/${lang}/browse`}
          label={t("browse.more")}
          lessLabel={t("browse.less")}
          countLabel={t("browse.moreCount", { count: behindMore.length })}
          accessibleName={t("browse.moreTitle")}
          previews={previews}
          className={tileClassName}
        />
      ) : withMore ? (
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
