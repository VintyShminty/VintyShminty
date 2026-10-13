import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/**
 * A seller badge as a stamp (D-019, row 13): an outline in the accent colour with an icon and the name.
 * No progress ring. Ours, not a copy of the reference product's round badge cards.
 */
function SellerStamp({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      className="h-8 flex-row items-center gap-xs self-start rounded-full border border-primary bg-background px-[12px]"
    >
      <Icon as={icon} size={14} className="text-primary" />
      <Text variant="pill" weight={600} className="text-primary">
        {label}
      </Text>
    </View>
  );
}

export { SellerStamp };
