import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function Profile() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background px-lg">
      <Text variant="title">{t("tabs.profile")}</Text>
      <Text variant="subtitle" className="mt-sm">
        {t("common.placeholderScreen")}
      </Text>
      {__DEV__ ? (
        <Link href="/gallery" asChild>
          <Button variant="outline" className="mt-xl">
            <Text>{t("gallery.open")}</Text>
          </Button>
        </Link>
      ) : null}
    </View>
  );
}
