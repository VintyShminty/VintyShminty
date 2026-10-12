import { useRouter } from "expo-router";
import { Bell, Globe, Lock, LogOut, Mail, ScanFace, ShieldCheck, User, UserCog } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Row, SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { useFaceId } from "@/lib/use-face-id";

/** Settings list. Rows for Postage, Payments, Holiday mode and so on arrive with their milestones. */
export default function Settings() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const faceId = useFaceId(session?.user.id);
  const [turningOn, setTurningOn] = useState(false);
  const method = t(`biometric.${faceId.kind}`);

  const logOut = () => {
    Alert.alert(t("settings.logOutTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logOut"),
        style: "destructive",
        onPress: async () => {
          await authClient.signOut();
          queryClient.clear();
        },
      },
    ]);
  };

  return (
    <Screen>
      <TopBar title={t("settings.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        {faceId.available && !faceId.enabled ? (
          <View className="mx-lg mt-sm flex-row gap-md rounded-control bg-accent-tint p-lg">
            <Icon as={ScanFace} size={24} className="text-primary" />
            <View className="flex-1 gap-sm">
              <Text weight={700}>{t("settings.promoTitle")}</Text>
              <Text variant="bodySmall" className="text-text-2">
                {t("settings.promoBody", { method })}
              </Text>
              <Button
                size="sm"
                className="mt-xs self-start"
                loading={turningOn}
                onPress={async () => {
                  setTurningOn(true);
                  await faceId.enable();
                  setTurningOn(false);
                }}
              >
                <Text>{t("settings.promoButton", { method })}</Text>
              </Button>
            </View>
          </View>
        ) : null}

        <View className="mt-sm">
          <Row
            icon={User}
            label={t("settings.profileDetails")}
            onPress={() => router.push("/edit-profile")}
          />
          <Row
            icon={UserCog}
            label={t("settings.account")}
            onPress={() => router.push("/settings/account")}
          />
          <Row
            icon={ShieldCheck}
            label={t("settings.security")}
            onPress={() => router.push("/settings/security")}
          />
          <Row
            icon={Lock}
            label={t("settings.privacy")}
            onPress={() => router.push("/settings/privacy")}
            last
          />
        </View>

        <SectionHeader>{t("settings.notifications")}</SectionHeader>
        <Row
          icon={Bell}
          label={t("settings.push")}
          onPress={() => router.push("/settings/push-notifications")}
        />
        <Row
          icon={Mail}
          label={t("settings.email")}
          onPress={() => router.push("/settings/email-notifications")}
          last
        />

        <SectionHeader>{t("settings.appLanguage")}</SectionHeader>
        <Row
          icon={Globe}
          label={t("settings.language")}
          value={t(`languages.${i18n.language}`)}
          onPress={() => router.push("/settings/language")}
          last
        />

        <View className="mt-xl">
          <Row icon={LogOut} label={t("settings.logOut")} destructive onPress={logOut} chevron={false} last />
        </View>
        {__DEV__ ? (
          <View className="mt-xl px-lg">
            <Button variant="ghost" size="sm" onPress={() => router.push("/gallery")}>
              <Text>{t("gallery.open")}</Text>
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
