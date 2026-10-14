import { BROWSE_MORE_TILES, BROWSE_TILES } from "@vinty/shared";
import { PhotoTile } from "@/components/photo-tile";
import { getT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The photo tiles of D-019 row 5, each linking to `/[lang]/browse/[tileKey]`. A server component, so the links are
 * in the page for Google. `withMore` adds the plain "More" tile that opens `/[lang]/browse`.
 * `more` shows the tiles behind More instead of the first ten (the Browse page lists both).
 * `tileClassName` sets the size of each tile, `className` the grid around them.
 */
export function BrowseTiles({
  lang,
  more = false,
  withMore = false,
  className,
  tileClassName = "h-[120px]",
  sizes,
}: {
  lang: Lang;
  more?: boolean;
  withMore?: boolean;
  className?: string;
  tileClassName?: string;
  sizes?: string;
}) {
  const t = getT(lang);
  return (
    <div className={cn("grid gap-md", className)}>
      {(more ? BROWSE_MORE_TILES : BROWSE_TILES).map((tile) => (
        <PhotoTile
          key={tile.key}
          href={`/${lang}/browse/${tile.key}`}
          label={t(`browse.tiles.${tile.key}`)}
          photo={tile.photo}
          sizes={sizes}
          className={tileClassName}
        />
      ))}
      {withMore ? (
        <PhotoTile
          href={`/${lang}/browse`}
          label={t("browse.more")}
          accessibleName={t("browse.moreTitle")}
          plain
          className={tileClassName}
        />
      ) : null}
    </div>
  );
}
