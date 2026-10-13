import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { HELP_ARTICLE_IDS, SUPPORT_EMAIL } from "@/lib/help-topics";

/** One Help article. The body is a few short paragraphs split by a blank line. */
export default function HelpArticle() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const known = HELP_ARTICLE_IDS.includes(id);
  const paragraphs = known ? t(`help.articles.${id}.body`).split("\n\n") : [];

  return (
    <Screen>
      <TopBar title={t("help.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-md px-lg pb-2xl pt-sm">
        {known ? (
          <>
            <Text variant="title" className="self-start" accessibilityRole="header">
              {t(`help.articles.${id}.title`)}
            </Text>
            {paragraphs.map((paragraph) => (
              <Text key={paragraph} className="self-start text-text-2">
                {paragraph}
              </Text>
            ))}
            <View className="mt-lg gap-sm rounded-control bg-surface p-lg">
              <Text weight={700}>{t("help.stillStuck.title")}</Text>
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onPress={() =>
                  void Linking.openURL(
                    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("help.stillStuck.subject"))}`,
                  ).catch(() => {})
                }
              >
                <Text>{t("help.stillStuck.button")}</Text>
              </Button>
            </View>
          </>
        ) : (
          <Text className="self-start text-text-2">{t("errors.loadFailed")}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}
