import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";

/** First screen for someone who is not logged in. */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen className="px-lg">
      <View className="pt-xl">
        <Text
          weight={800}
          className="text-primary"
          style={{ fontSize: 28, lineHeight: 34, letterSpacing: -1 }}
        >
          Vinty
        </Text>
      </View>
      <View className="flex-1 justify-center pb-2xl">
        <Text variant="display">{t("welcome.heroLight")}</Text>
        <Text variant="display" weight={800}>
          {t("welcome.heroBold")}
        </Text>
        <Text variant="subtitle" className="mt-lg max-w-[320px]">
          {t("welcome.subtitle")}
        </Text>
      </View>
      <View className="gap-md pb-md">
        <Button size="lg" onPress={() => router.push("/sign-up")}>
          <Text>{t("welcome.signUp")}</Text>
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push("/log-in")}>
          <Text>{t("welcome.logIn")}</Text>
        </Button>
      </View>
    </Screen>
  );
}
