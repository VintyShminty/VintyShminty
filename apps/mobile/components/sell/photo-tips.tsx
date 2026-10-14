import { Sparkles, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { visibleTips } from "@/lib/photo-tips";
import { useSellStore } from "@/lib/sell-store";

/**
 * Quiet tips under the photo row (D-036): at most two lines, one per photo, each with a small close button. They never
 * block saving or posting.
 */
function PhotoTips() {
  const { t } = useTranslation();
  const photos = useSellStore((s) => s.values.photos);
  const tips = useSellStore((s) => s.photoTips);
  const dismissed = useSellStore((s) => s.dismissedTips);
  const dismissTip = useSellStore((s) => s.dismissTip);
  const lines = visibleTips(
    photos.map((p) => p.key),
    tips,
    dismissed,
  );
  if (lines.length === 0) return null;
  return (
    <View className="gap-sm">
      {lines.map((line) => (
        <View key={line.key} className="flex-row items-start gap-sm">
          <Icon as={Sparkles} size={16} className="mt-px text-text-3" />
          <Text variant="cardDesc" className="flex-1 text-text-3">
            {t(`sell.assist.photoTips.${line.kind}`, { n: line.n })}
          </Text>
          <Pressable
            onPress={() => dismissTip(line.key)}
            hitSlop={10}
            role="button"
            accessibilityLabel={t("sell.assist.photoTips.close")}
          >
            <Icon as={X} size={16} className="text-text-3" />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export { PhotoTips };
