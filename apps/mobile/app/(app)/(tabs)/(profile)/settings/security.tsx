import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Smartphone } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SectionHeader, SwitchRow } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { authClient } from "@/lib/auth-client";
import { timeAgo } from "@/lib/time";
import { useFaceId } from "@/lib/use-face-id";

type SessionRow = {
  id: string;
  token: string;
  userAgent?: string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
};

/** "Vinty/1.0 (iPhone 17 Pro; iOS 26.0)" -> "iPhone 17 Pro" */
function deviceName(userAgent: string | null | undefined, fallback: string) {
  const inside = userAgent?.match(/\(([^;)]+)/)?.[1]?.trim();
  return inside || fallback;
}

/** Settings, Security: the Log in with Face ID switch and the devices that are logged in. */
export default function Security() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const faceId = useFaceId(session?.user);
  const [failed, setFailed] = useState(false);
  const method = t(`biometric.${faceId.kind}`);

  const sessionsQ = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message);
      return (data ?? []) as SessionRow[];
    },
  });

  const revoke = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const revokeOthers = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const toggleFaceId = async (on: boolean) => {
    setFailed(false);
    if (!on) return faceId.disable();
    const ok = await faceId.enable();
    if (ok === false) setFailed(true);
  };

  const currentToken = session?.session.token;
  const sessions = sessionsQ.data ?? [];
  const others = sessions.filter((s) => s.token !== currentToken);

  return (
    <Screen>
      <TopBar title={t("security.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        {faceId.available && (faceId.canEnableHere || faceId.enabled) ? (
          <>
            <SwitchRow
              label={t("security.faceId", { method })}
              description={t("security.faceIdHint", { method })}
              checked={faceId.enabled}
              onCheckedChange={toggleFaceId}
              last
            />
            {failed ? (
              <View className="px-lg pt-md">
                <Banner variant="error">{t("faceId.turnOnFailed", { method })}</Banner>
              </View>
            ) : null}
          </>
        ) : null}

        <SectionHeader>{t("security.sessions")}</SectionHeader>
        {sessionsQ.isPending ? <Spinner /> : null}
        {sessionsQ.isError ? (
          <View className="px-lg">
            <Banner variant="error">{t("errors.loadFailed")}</Banner>
          </View>
        ) : null}
        {sessions
          .slice()
          .sort((a, b) => (a.token === currentToken ? -1 : b.token === currentToken ? 1 : 0))
          .map((s, index) => {
            const isCurrent = s.token === currentToken;
            return (
              <View
                key={s.id}
                className={`min-h-[64px] flex-row items-center gap-md px-lg py-md ${index < sessions.length - 1 ? "border-b border-border-subtle" : ""}`}
              >
                <Icon as={Smartphone} size={22} className="text-text-2" />
                <View className="flex-1 gap-xs">
                  <Text weight={500}>{deviceName(s.userAgent, t("security.unknownDevice"))}</Text>
                  <Text variant="cardMeta">
                    {isCurrent ? t("security.activeNow") : timeAgo(new Date(s.updatedAt).toISOString(), t)}
                  </Text>
                </View>
                {isCurrent ? (
                  <Badge variant="success" icon={Check} label={t("security.thisDevice")} />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={revoke.isPending && revoke.variables === s.token}
                    onPress={() => revoke.mutate(s.token)}
                  >
                    <Text>{t("security.logOutDevice")}</Text>
                  </Button>
                )}
              </View>
            );
          })}
        {others.length > 0 ? (
          <View className="px-lg pt-lg">
            <Button
              variant="outline"
              loading={revokeOthers.isPending}
              onPress={() =>
                Alert.alert(t("security.logOutOthersTitle"), t("security.logOutOthersBody"), [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("security.logOutOthers"),
                    style: "destructive",
                    onPress: () => revokeOthers.mutate(),
                  },
                ])
              }
            >
              <Text>{t("security.logOutOthers")}</Text>
            </Button>
          </View>
        ) : sessionsQ.isSuccess ? (
          <Text variant="cardDesc" className="px-lg pt-md text-text-3">
            {t("security.onlyThisDevice")}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
