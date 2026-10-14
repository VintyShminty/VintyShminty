"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  NOTIFICATION_DEFAULT_ENABLED,
  NOTIFICATION_SETTINGS_GROUPS,
  type NotificationType,
  notificationPreferenceSchema,
  type UserSettings,
} from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Notice } from "@/components/auth/fields";
import { SectionLabel, SwitchRow } from "@/components/settings/page-head";
import { Switch } from "@/components/switch";
import { clientApi } from "@/lib/api-client";
import { useSettings, useUpdateSettings } from "@/lib/settings-hooks";

type Preference = z.infer<typeof notificationPreferenceSchema>;
const preferenceList = z.array(notificationPreferenceSchema);

const isEnabled = (list: Preference[], type: NotificationType) =>
  list.find((p) => p.type === type && p.channel === "email")?.enabled ?? NOTIFICATION_DEFAULT_ENABLED;

/**
 * Settings, Alerts. The website shows "By email" only (D-030, decision 8): alerts to a phone have no meaning in a browser
 * and are set in the app. A switch for each kind of alert in the two groups of the app, and the master switch at the end.
 */
export function EmailAlerts({
  initialSettings,
  initialPrefs,
}: {
  initialSettings: UserSettings;
  initialPrefs: Preference[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useSettings(initialSettings).data ?? initialSettings;
  const updateSettings = useUpdateSettings();
  const prefs =
    useQuery({
      queryKey: ["notification-preferences"],
      queryFn: () => clientApi("/v1/me/notification-preferences", { schema: preferenceList }),
      initialData: initialPrefs,
      staleTime: 5 * 60_000,
    }).data ?? initialPrefs;

  const updatePref = useMutation({
    mutationFn: (pref: Preference) =>
      clientApi("/v1/me/notification-preferences", {
        method: "PUT",
        body: { preferences: [pref] },
        schema: preferenceList,
      }),
    onMutate: async (pref) => {
      await queryClient.cancelQueries({ queryKey: ["notification-preferences"] });
      const previous = queryClient.getQueryData<Preference[]>(["notification-preferences"]);
      if (previous) {
        const exists = previous.some((p) => p.type === pref.type && p.channel === pref.channel);
        queryClient.setQueryData(
          ["notification-preferences"],
          exists
            ? previous.map((p) => (p.type === pref.type && p.channel === pref.channel ? pref : p))
            : [...previous, pref],
        );
      }
      return { previous };
    },
    onError: (_err, _pref, context) => {
      if (context?.previous) queryClient.setQueryData(["notification-preferences"], context.previous);
    },
    onSuccess: (list) => queryClient.setQueryData(["notification-preferences"], list),
  });

  const masterOn = settings.emailEnabled;
  return (
    <div>
      {updatePref.isError || updateSettings.isError ? (
        <Notice kind="error">{t("errors.general")}</Notice>
      ) : null}
      <p className="mb-lg rounded-control bg-surface px-md py-md text-body-sm text-text-2">
        {t("web.settings.phoneAlertsNote")}
      </p>
      <h2 className="text-heading font-bold text-text-1">{t("settings.email")}</h2>
      {NOTIFICATION_SETTINGS_GROUPS.map(({ group, types }) => (
        <div key={group}>
          <SectionLabel>{t(`notifications.groups.${group}`)}</SectionLabel>
          {types.map((type) => (
            <SwitchRow key={type} label={t(`notifications.types.${type}`)}>
              <Switch
                checked={masterOn && isEnabled(prefs, type)}
                disabled={!masterOn}
                label={t(`notifications.types.${type}`)}
                onChange={(enabled) => updatePref.mutate({ type, channel: "email", enabled })}
              />
            </SwitchRow>
          ))}
        </div>
      ))}
      <div className="mt-xl border-t border-border-subtle">
        <SwitchRow label={t("notifications.enableEmail")}>
          <Switch
            checked={masterOn}
            label={t("notifications.enableEmail")}
            onChange={(emailEnabled) => updateSettings.mutate({ emailEnabled })}
          />
        </SwitchRow>
      </div>
      <p className="pt-md text-card-desc text-text-3">{t("notifications.notSentYet")}</p>
    </div>
  );
}
