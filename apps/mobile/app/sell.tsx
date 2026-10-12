import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

export default function Sell() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text variant="title">{t("tabs.sell")}</Text>
      <Text variant="subtitle" className="mt-sm">
        {t("common.placeholderScreen")}
      </Text>
    </View>
  );
}
