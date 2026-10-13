import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/** Grey placeholder rows for a list that is loading its first page. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: rows }, (_, n) => n).map((n) => (
        <View key={n} className="flex-row items-center gap-md px-lg py-md">
          <View className="h-[64px] w-[64px] rounded-control bg-pressed" />
          <View className="flex-1 gap-sm">
            <View className="h-3 w-2/3 rounded-full bg-pressed" />
            <View className="h-3 w-1/3 rounded-full bg-surface" />
            <View className="h-3 w-1/2 rounded-full bg-pressed" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <View className="items-center gap-sm px-xl py-2xl">
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      {note ? (
        <Text variant="subtitle" className="text-center text-text-3">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-md px-xl py-2xl">
      <Text variant="heading" className="text-center">
        {t("errors.general")}
      </Text>
      <Button variant="outline" onPress={onRetry}>
        <Text>{t("common.tryAgain")}</Text>
      </Button>
    </View>
  );
}
