import { Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/** A quiet mark next to a field the photo helper filled in, until the seller changes it (D-028). */
function SuggestedTag() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-xs" accessibilityLabel={t("sell.assist.suggested")}>
      <Icon as={Sparkles} size={12} className="text-primary" />
      <Text variant="smallLabel" className="text-text-3">
        {t("sell.assist.suggested")}
      </Text>
    </View>
  );
}

export { SuggestedTag };
