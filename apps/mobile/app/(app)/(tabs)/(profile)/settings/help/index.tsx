import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Row, SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { helpAskQuery } from "@/lib/help-ask";
import { cleanQuestion, helpAskView } from "@/lib/help-ask-view";
import { HELP_GROUPS, SUPPORT_EMAIL } from "@/lib/help-topics";
import { photoAssistStatusQuery } from "@/lib/sell-assist";

/** Settings, Help: the bundled Help Centre. Five groups of short articles, then a way to write to us. */
export default function Help() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const language = i18n.language === "he" ? "he" : "en";
  const { data: status } = useQuery(photoAssistStatusQuery());
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const ask = useQuery({ ...helpAskQuery(asked ?? "", language), enabled: asked !== null });
  const view = helpAskView({
    asked: asked !== null,
    pending: ask.isFetching && !ask.data,
    failed: ask.isError,
    data: ask.data,
  });
  const submit = () => {
    const q = cleanQuestion(text);
    if (!q) return;
    if (q === asked) void ask.refetch();
    else setAsked(q);
  };

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
        {status?.helpAssist ? (
          <View className="mx-lg mt-lg gap-sm">
            <Input
              label={t("help.ask.title")}
              placeholder={t("help.ask.placeholder")}
              value={text}
              onChangeText={setText}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={submit}
            />
            <Button
              size="sm"
              className="self-start"
              disabled={!cleanQuestion(text) || view === "thinking"}
              onPress={submit}
            >
              <Text>{t("help.ask.button")}</Text>
            </Button>
            {view === "thinking" ? (
              <View className="flex-row items-center gap-sm">
                <Icon as={Sparkles} size={16} className="text-text-3" />
                <Text variant="bodySmall" className="text-text-3">
                  {t("help.ask.thinking")}
                </Text>
              </View>
            ) : null}
            {view === "answer" && ask.data ? (
              <View className="gap-sm rounded-control bg-surface p-lg">
                <Text>{ask.data.answer}</Text>
                <View className="flex-row items-center gap-xs">
                  <Icon as={Sparkles} size={13} className="text-text-3" />
                  <Text variant="bodySmall" className="shrink text-text-3">
                    {t("help.ask.label")}
                  </Text>
                </View>
                {ask.data.articleIds.map((id) => (
                  <Text
                    key={id}
                    variant="bodySmall"
                    weight={600}
                    className="text-primary"
                    onPress={() => router.push({ pathname: "/settings/help/[id]", params: { id } })}
                  >
                    {t("help.ask.readMore")}: {t(`help.articles.${id}.title`)}
                  </Text>
                ))}
              </View>
            ) : null}
            {view === "noAnswer" ? (
              <View className="gap-sm">
                <Text variant="bodySmall" className="text-text-3">
                  {t("help.ask.noAnswer")}
                </Text>
                <Button size="sm" variant="outline" className="self-start" onPress={writeToUs}>
                  <Text>{t("help.stillStuck.button")}</Text>
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}
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
