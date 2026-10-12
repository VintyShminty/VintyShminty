import { useQuery } from "@tanstack/react-query";
import {
  NOTIFICATION_SETTINGS_GROUPS,
  type NotificationChannel,
  PUSH_DAILY_LIMIT_OPTIONS,
} from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { Chip } from "@/components/ui/chip";
import { SectionHeader, SwitchRow } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import {
  isPreferenceEnabled,
  preferencesQuery,
  settingsQuery,
  useUpdatePreference,
  useUpdateSettings,
} from "@/lib/queries";

/**
 * Push notifications and Email notifications (spec: grouped switches, a daily limit for push, a master switch at the end).
 * Switches save as you tap. Nothing is sent yet: the notifications arrive with the milestones that create them.
 */
export function NotificationSettings({ channel }: { channel: NotificationChannel }) {
  const { t } = useTranslation();
  const settingsQ = useQuery(settingsQuery());
  const prefsQ = useQuery(preferencesQuery());
  const updateSettings = useUpdateSettings();
  const updatePref = useUpdatePreference();

  const settings = settingsQ.data;
  const prefs = prefsQ.data;
  const masterOn = channel === "push" ? settings?.pushEnabled : settings?.emailEnabled;
  const title = channel === "push" ? t("settings.push") : t("settings.email");

  if (!settings || !prefs) {
    return (
      <Screen>
        <TopBar title={title} />
        {settingsQ.isError || prefsQ.isError ? (
          <View className="px-lg">
            <Banner variant="error">{t("errors.loadFailed")}</Banner>
          </View>
        ) : (
          <Spinner />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={title} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        {NOTIFICATION_SETTINGS_GROUPS.map(({ group, types }) => (
          <View key={group}>
            <SectionHeader>{t(`notifications.groups.${group}`)}</SectionHeader>
            {types.map((type, index) => (
              <SwitchRow
                key={type}
                label={t(`notifications.types.${type}`)}
                checked={Boolean(masterOn) && isPreferenceEnabled(prefs, type, channel)}
                disabled={!masterOn}
                onCheckedChange={(enabled) => updatePref.mutate({ type, channel, enabled })}
                last={index === types.length - 1}
              />
            ))}
          </View>
        ))}

        {channel === "push" ? (
          <View>
            <SectionHeader>{t("notifications.dailyLimit")}</SectionHeader>
            <View className="flex-row flex-wrap gap-sm px-lg">
              {PUSH_DAILY_LIMIT_OPTIONS.map((limit) => (
                <Chip
                  key={String(limit)}
                  label={
                    limit === null ? t("notifications.noLimit") : t("notifications.upTo", { count: limit })
                  }
                  selected={settings.pushDailyLimit === limit}
                  onPress={() => updateSettings.mutate({ pushDailyLimit: limit })}
                  disabled={!masterOn}
                />
              ))}
            </View>
            <Text variant="cardDesc" className="px-lg pt-sm text-text-3">
              {t("notifications.dailyLimitHint")}
            </Text>
          </View>
        ) : null}

        <View className="mt-xl border-t border-border-subtle">
          <SwitchRow
            label={channel === "push" ? t("notifications.enablePush") : t("notifications.enableEmail")}
            checked={Boolean(masterOn)}
            onCheckedChange={(enabled) =>
              updateSettings.mutate(channel === "push" ? { pushEnabled: enabled } : { emailEnabled: enabled })
            }
            last
          />
        </View>
        <Text variant="cardDesc" className="px-lg pt-md text-text-3">
          {t("notifications.notSentYet")}
        </Text>
      </ScrollView>
    </Screen>
  );
}
