import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

/** One label and value line in the Details list of an item page. Hidden when there is no value. */
export function DetailRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null | undefined;
  /** Makes the value a tappable link (the brand opens its search results). */
  onPress?: () => void;
}) {
  if (!value) return null;
  return (
    <View className="flex-row gap-md border-b border-border-subtle py-md">
      <Text variant="bodySmall" className="w-[38%] text-text-3">
        {label}
      </Text>
      {onPress ? (
        <Pressable
          onPress={onPress}
          role="link"
          accessibilityLabel={value}
          className="flex-1 active:opacity-70"
        >
          <Text variant="bodySmall" weight={600} className="underline">
            {value}
          </Text>
        </Pressable>
      ) : (
        <Text variant="bodySmall" weight={600} className="flex-1">
          {value}
        </Text>
      )}
    </View>
  );
}

/**
 * The size and condition that follow the brand in the line under an item's title ("Zara · M · Good"). The brand
 * itself is a separate tappable piece, so this gives the rest, with the separator in front when a brand came first.
 */
export function subtitleRest(
  listing: {
    size?: { label: string } | null;
    condition?: { name: { en: string; he: string } | null } | null;
  },
  name: (n: { en: string; he: string } | null | undefined) => string,
  afterBrand: boolean,
): string {
  const rest = [listing.size?.label, name(listing.condition?.name)].filter(Boolean).join(" · ");
  return afterBrand && rest ? ` · ${rest}` : rest;
}
