import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";

/** A small tap target next to an empty field: fills in the helper's suggestion with one tap (D-028). */
function UseItChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      role="button"
      accessibilityLabel={label}
      className="rounded-full border border-text-4 px-md py-xs active:bg-pressed"
    >
      <Text variant="pill" weight={600} className="text-primary">
        {label}
      </Text>
    </Pressable>
  );
}

export { UseItChip };
