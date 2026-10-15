import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/** A placeholder row while the first page loads. */
function SkeletonRow() {
  return (
    <View
      className="flex-row items-center gap-md px-lg py-md"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="h-[52px] w-[52px] rounded-full bg-pressed" />
      <View className="flex-1 gap-sm">
        <View className="h-3 w-1/3 rounded-full bg-pressed" />
        <View className="h-3 w-1/2 rounded-full bg-surface" />
        <View className="h-3 w-2/3 rounded-full bg-pressed" />
      </View>
      <View className="h-[52px] w-[52px] rounded-control bg-pressed" />
    </View>
  );
}

export function Skeleton() {
  return (
    <View>
      {[0, 1, 2, 3, 4].map((n) => (
        <SkeletonRow key={n} />
      ))}
    </View>
  );
}

export function Empty({ title, note }: { title: string; note: string }) {
  return (
    <View className="items-center gap-sm px-xl py-2xl">
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      <Text variant="subtitle" className="text-center text-text-3">
        {note}
      </Text>
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
