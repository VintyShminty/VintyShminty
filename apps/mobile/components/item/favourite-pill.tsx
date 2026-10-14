import { useQueryClient } from "@tanstack/react-query";
import type { ListingDetail } from "@vinty/shared";
import { Bookmark } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useToggleFavourite } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

/**
 * Bookmark with the number of people who saved the item (docs/components.md, SavePill, pill variant).
 * It flips straight away, and flips back if the server says no.
 */
function FavouritePill({ listing }: { listing: ListingDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toggle = useToggleFavourite();
  const on = listing.viewer.isFavourited;

  const press = () => {
    const next = !on;
    const key = ["listing", listing.id];
    const apply = (favourite: boolean, count: number) =>
      queryClient.setQueryData<ListingDetail>(key, (old) =>
        old
          ? {
              ...old,
              favouriteCount: Math.max(0, count),
              viewer: { ...old.viewer, isFavourited: favourite },
            }
          : old,
      );
    apply(next, listing.favouriteCount + (next ? 1 : -1));
    toggle.mutate({ id: listing.id, favourite: next }, { onError: () => apply(on, listing.favouriteCount) });
  };

  return (
    <Pressable
      onPress={press}
      role="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? t("item.removeFavourite") : t("item.addFavourite")}
      className={cn(
        "h-9 flex-row items-center gap-xs rounded-full border px-md active:bg-pressed",
        on ? "border-error bg-error-tint" : "border-border bg-background",
      )}
    >
      <Icon
        as={Bookmark}
        size={16}
        className={on ? "text-error" : "text-text-2"}
        fill={on ? colors.error : "none"}
      />
      <Text variant="pill" weight={600} className={on ? "text-error" : "text-text-2"}>
        {listing.favouriteCount}
      </Text>
    </Pressable>
  );
}

export { FavouritePill };
