import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useSellerBundle } from "@/lib/bundle-queries";
import { cn } from "@/lib/utils";

/**
 * The small "+ Bundle" pill at the bottom end of a seller's other items (D-049). It becomes "In bundle" with a tick
 * once the item is in, and a tap on it takes the item out again. Shown only while the seller's bundles are on.
 */
function BundleCardButton({
  listingId,
  sellerId,
  title,
}: {
  listingId: string;
  sellerId: string;
  title: string;
}) {
  const { t } = useTranslation();
  const { ladder, busy, inBundle, add, remove } = useSellerBundle(sellerId);
  if (!ladder?.on || ladder.tiers.length === 0) return null;
  const inside = inBundle(listingId);
  return (
    <Pressable
      role="button"
      hitSlop={6}
      // Never disabled: a disabled pill lets the tap fall through to the card, which opens the item instead.
      accessibilityState={{ selected: inside, busy }}
      accessibilityLabel={t(inside ? "bundle.removeLabel" : "bundle.addLabel", { title })}
      onPress={() => {
        if (busy) return;
        if (inside) remove(listingId);
        else add(listingId);
      }}
      className={cn(
        "absolute bottom-sm end-sm h-7 flex-row items-center gap-xs rounded-full px-sm",
        inside ? "bg-primary" : "bg-background",
        busy && "opacity-60",
      )}
    >
      {inside ? <Icon as={Check} size={13} strokeWidth={3} className="text-primary-foreground" /> : null}
      <Text variant="cardMeta" weight={600} className={inside ? "text-primary-foreground" : "text-primary"}>
        {inside ? t("bundle.cardIn") : t("bundle.cardAdd")}
      </Text>
    </Pressable>
  );
}

export { BundleCardButton };
