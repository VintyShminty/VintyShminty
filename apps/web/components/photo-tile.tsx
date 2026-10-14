import Image from "next/image";
import Link from "next/link";
import { tilePhoto } from "@/lib/browse-photos";
import { cn } from "@/lib/utils";

/**
 * A Browse tile (D-019, row 5): a photo with the name at the bottom start over a dark gradient, 12px corners.
 * The gradient is the text-1 token faded with a mask, so no colour value lives here. Give it a size with
 * `className` (a height or an aspect ratio) and say how wide it is with `sizes` so the right file loads.
 * Without a `photo` the tile is a plain tint (the "More" tile in the Browse panel).
 */
export function PhotoTile({
  href,
  label,
  photo,
  sizes = "160px",
  className,
  plain = false,
  imageUrl,
  selected = false,
  replace = false,
  scroll,
  accessibleName,
}: {
  href: string;
  /** A fuller name for screen readers when the visible label alone is unclear (the "More" tile). */
  accessibleName?: string;
  label: string;
  /** The file name from the shared tile list (`tile.photo`). */
  photo?: string;
  sizes?: string;
  className?: string;
  /** A tint instead of a photo, with dark text. */
  plain?: boolean;
  /** A photo from the web (a listing cover) instead of a file from the shared tile list. */
  imageUrl?: string;
  /** The chosen tile of a strip: outlined in espresso. */
  selected?: boolean;
  /** Changes the address without adding a history entry (the strip on a results page). */
  replace?: boolean;
  scroll?: boolean;
}) {
  const image = photo ? tilePhoto(photo) : undefined;
  const hasPhoto = Boolean(image ?? imageUrl);
  return (
    <Link
      href={href}
      replace={replace}
      scroll={scroll}
      aria-label={accessibleName}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative block overflow-hidden rounded-control",
        plain ? "bg-accent-tint" : "bg-pressed",
        className,
      )}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          placeholder="blur"
          className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : null}
      {imageUrl ? (
        // biome-ignore lint/performance/noImgElement: a listing cover that comes ready sized, no image optimisation on purpose
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : null}
      {hasPhoto ? (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3/5 bg-text-1 opacity-[0.78] [mask-image:linear-gradient(to_bottom,transparent,black)]"
        />
      ) : null}
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 p-md text-body-sm font-bold",
          plain || !hasPhoto ? "text-text-1" : "text-primary-foreground",
        )}
      >
        {label}
      </span>
      {selected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-control border-[3px] border-primary"
        />
      ) : null}
    </Link>
  );
}
