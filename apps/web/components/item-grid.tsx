import type { ListingCard } from "@vinty/shared";
import type { ReactNode } from "react";
import { ItemCard, ItemCardSkeleton } from "@/components/item-card";

/** The grid classes (D-030): 5 across on a laptop, 4 on a small laptop, 3 on a tablet, 2 on a phone. */
export const GRID_CLASSES = "grid grid-cols-2 gap-x-lg gap-y-xl md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/**
 * A grid of item cards. Pass the cards, or children for anything else that should sit in the same grid
 * (for example skeletons). `InfiniteItemGrid` is the one that keeps loading as you scroll.
 */
export function ItemGrid({
  items,
  hideHearts,
  heartOnSold,
  children,
}: {
  items: readonly ListingCard[];
  hideHearts?: boolean;
  heartOnSold?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={GRID_CLASSES}>
      {items.map((listing) => (
        <ItemCard key={listing.id} listing={listing} hideHeart={hideHearts} heartOnSold={heartOnSold} />
      ))}
      {children}
    </div>
  );
}

/** The loading grid: a few placeholder cards in the same columns. */
export function ItemGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className={GRID_CLASSES}>
      {Array.from({ length: count }, (_, n) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
        <ItemCardSkeleton key={n} />
      ))}
    </div>
  );
}
