import { Pencil, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type PickerRowProps = {
  label: string;
  /** The chosen value. Empty shows a plus, filled shows the value with a pencil. */
  value?: string | null;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
};

/** An outlined sell form row that opens a picker (docs/components.md, PickerRow). */
function PickerRow({ label, value, onPress, error, disabled }: PickerRowProps) {
  const filled = Boolean(value);
  return (
    <View className="gap-xs">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        role="button"
        accessibilityLabel={filled ? `${label}, ${value}` : label}
        accessibilityState={{ disabled }}
        className={cn(
          "min-h-[52px] flex-row items-center gap-md rounded-control border bg-background px-[14px] py-sm active:bg-surface",
          error ? "border-error" : "border-border",
          disabled && "bg-surface opacity-40",
        )}
      >
        {filled ? (
          <View className="flex-1">
            <Text variant="smallLabel" weight={600}>
              {label}
            </Text>
            <Text weight={600} numberOfLines={1}>
              {value}
            </Text>
          </View>
        ) : (
          <Text className="flex-1 text-text-3">{label}</Text>
        )}
        <Icon as={filled ? Pencil : Plus} size={filled ? 18 : 20} className="text-primary" />
      </Pressable>
      {error ? (
        <Text variant="cardDesc" className="text-error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export { PickerRow };
