import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { AlertTriangle, AtSign, Check, KeyRound, Mail, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Row, SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { meQuery } from "@/lib/queries";

/** Settings, Account settings: email, username, password and closing the account. */
export default function AccountSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: me } = useQuery(meQuery());

  return (
    <Screen>
      <TopBar title={t("account.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        <Row
          icon={Mail}
          label={t("fields.email")}
          value={me?.email}
          onPress={() => router.push("/settings/change-email")}
        />
        {me && !me.emailVerified ? (
          <Row
            label={t("account.verifyEmail")}
            trailing={<Badge variant="warning" icon={AlertTriangle} label={t("account.notVerified")} />}
            onPress={() => router.push("/settings/verify-email")}
          />
        ) : me ? (
          <Row
            label={t("account.emailStatus")}
            trailing={<Badge variant="success" icon={Check} label={t("account.verified")} />}
            chevron={false}
          />
        ) : null}
        <Row
          icon={AtSign}
          label={t("fields.username")}
          value={me?.username ?? undefined}
          onPress={() => router.push("/settings/change-username")}
        />
        <Row
          icon={KeyRound}
          label={t("account.changePassword")}
          onPress={() => router.push("/settings/change-password")}
          last
        />
        <SectionHeader>{t("account.dangerZone")}</SectionHeader>
        <Row
          icon={Trash2}
          label={t("account.delete")}
          destructive
          onPress={() => router.push("/settings/delete-account")}
          last
        />
      </ScrollView>
    </Screen>
  );
}
