import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Row, SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { HELP_GROUPS, SUPPORT_EMAIL } from "@/lib/help-topics";

/** Settings, Help: the bundled Help Centre. Five groups of short articles, then a way to write to us. */
export default function Help() {
  const { t } = useTranslation();
  const router = useRouter();

  const writeToUs = () => {
    const subject = encodeURIComponent(t("help.stillStuck.subject"));
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {});
  };

  return (
    <Screen>
      <TopBar title={t("help.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        <Text variant="bodySmall" className="px-lg pt-sm text-text-3">
          {t("help.intro")}
        </Text>
        {HELP_GROUPS.map((group) => (
          <View key={group.id}>
            <SectionHeader>{t(`help.groups.${group.id}`)}</SectionHeader>
            {group.articles.map((id, index) => (
              <Row
                key={id}
                label={t(`help.articles.${id}.title`)}
                onPress={() => router.push({ pathname: "/settings/help/[id]", params: { id } })}
                last={index === group.articles.length - 1}
              />
            ))}
          </View>
        ))}
        <View className="mx-lg mt-xl gap-sm rounded-control bg-surface p-lg">
          <Text weight={700}>{t("help.stillStuck.title")}</Text>
          <Text variant="bodySmall" className="text-text-2">
            {t("help.stillStuck.note")}
          </Text>
          <Button size="sm" className="mt-xs self-start" onPress={writeToUs}>
            <Text>{t("help.stillStuck.button")}</Text>
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
