import { useQuery } from "@tanstack/react-query";
import { Moon } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { SectionHeader, SwitchRow } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { meQuery, useSetAwayMode } from "@/lib/queries";
import { formatDate } from "@/lib/time";

const DAY_MS = 86_400_000;
/** Ready made return dates. The server allows up to 90 days. */
const PRESETS = [
  { key: "week1", days: 7 },
  { key: "week2", days: 14 },
  { key: "month1", days: 30 },
  { key: "month2", days: 60 },
] as const;

/**
 * Settings, Away mode (D-020). A switch and an optional return date. No date means away until you switch it off.
 * The return date is picked from ready made choices, so no native date picker is needed.
 */
export default function AwayMode() {
  const { t, i18n } = useTranslation();
  const { data: me } = useQuery(meQuery());
  const setAway = useSetAwayMode(me?.id);
  const [failed, setFailed] = useState<string | null>(null);

  if (!me) {
    return (
      <Screen>
        <TopBar title={t("away.title")} />
        <Spinner />
      </Screen>
    );
  }

  const enabled = me.profile.holidayMode;
  const endsAt = me.profile.holidayEndsAt;

  const save = (input: { enabled: boolean; endsAt?: string | null }) => {
    setFailed(null);
    setAway.mutate(input, {
      onError: (err) =>
        setFailed(
          err instanceof ApiClientError && err.fields?.endsAt ? t(err.fields.endsAt) : t("away.failed"),
        ),
    });
  };

  return (
    <Screen>
      <TopBar title={t("away.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        {failed ? (
          <Banner variant="error" className="mx-lg mb-sm">
            {failed}
          </Banner>
        ) : null}
        <SwitchRow
          label={t("away.title")}
          description={t("away.switchHint")}
          checked={enabled}
          disabled={setAway.isPending}
          onCheckedChange={(value) => save({ enabled: value })}
          last
        />
        {enabled ? (
          <>
            <View className="mx-lg mt-md flex-row items-center gap-sm">
              <Icon as={Moon} size={16} className="text-text-3" />
              <Text variant="bodySmall" className="flex-1 text-text-2">
                {endsAt
                  ? t("away.statusUntil", { date: formatDate(endsAt, i18n.language) })
                  : t("away.statusOpen")}
              </Text>
            </View>
            <SectionHeader>{t("away.backOn")}</SectionHeader>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-sm px-lg"
            >
              {PRESETS.map(({ key, days }) => (
                <Chip
                  key={key}
                  label={t(`away.preset.${key}`)}
                  disabled={setAway.isPending}
                  onPress={() =>
                    save({ enabled: true, endsAt: new Date(Date.now() + days * DAY_MS).toISOString() })
                  }
                />
              ))}
              <Chip
                label={t("away.preset.none")}
                selected={!endsAt}
                disabled={setAway.isPending}
                onPress={() => save({ enabled: true, endsAt: null })}
              />
            </ScrollView>
            <Text variant="cardDesc" className="mt-sm px-lg text-text-3">
              {t("away.backOnHint")}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
