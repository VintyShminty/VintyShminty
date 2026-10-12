import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Radio } from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { ForwardIcon } from "@/components/ui/top-bar";

type CategoryRowProps = {
  label: string;
  icon?: LucideIcon;
  /** A path under the label, used for search results ("Women, Dresses"). */
  detail?: string;
  /** "branch" shows a chevron and opens the next level. "leaf" shows a radio. */
  kind: "branch" | "leaf";
  selected?: boolean;
  onPress: () => void;
};

/** One line of a category panel: icon, label in regular weight (D-013), chevron or radio. 56px, hairline below. */
function CategoryRow({ label, icon, detail, kind, selected = false, onPress }: CategoryRowProps) {
  return (
    <Pressable
      onPress={onPress}
      role={kind === "leaf" ? "radio" : "button"}
      accessibilityState={kind === "leaf" ? { checked: selected } : undefined}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      className="active:bg-surface"
    >
      <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg py-sm">
        {icon ? <Icon as={icon} size={20} className="text-primary" /> : null}
        <View className="flex-1">
          <Text>{label}</Text>
          {detail ? (
            <Text variant="cardDesc" className="text-text-3" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        {kind === "leaf" ? <Radio checked={selected} /> : <ForwardIcon />}
      </View>
    </Pressable>
  );
}

export { CategoryRow };
