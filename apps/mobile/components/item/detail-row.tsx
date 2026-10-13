import { View } from "react-native";
import { Text } from "@/components/ui/text";

/** One label and value line in the Details list of an item page. Hidden when there is no value. */
export function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View className="flex-row gap-md border-b border-border-subtle py-md">
      <Text variant="bodySmall" className="w-[38%] text-text-3">
        {label}
      </Text>
      <Text variant="bodySmall" weight={600} className="flex-1">
        {value}
      </Text>
    </View>
  );
}
