"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { UserSettings } from "@vinty/shared";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { SwitchRow } from "@/components/settings/page-head";
import { Switch } from "@/components/switch";
import { useSettings, useUpdateSettings } from "@/lib/settings-hooks";

/** Settings, Your privacy: "Last seen" on your profile, and the switch that lets Home learn from what you do. */
export function PrivacySwitches({ initial }: { initial: UserSettings }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const settings = useSettings(initial).data ?? initial;
  const update = useUpdateSettings();
  return (
    <div>
      {update.isError ? <Notice kind="error">{t("errors.general")}</Notice> : null}
      <SwitchRow label={t("privacy.showLastSeen")} hint={t("privacy.showLastSeenHint")}>
        <Switch
          checked={settings.showLastSeen}
          label={t("privacy.showLastSeen")}
          onChange={(showLastSeen) => update.mutate({ showLastSeen })}
        />
      </SwitchRow>
      <SwitchRow label={t("privacy.tailorFeed")} hint={t("privacy.tailorFeedHint")}>
        <Switch
          checked={settings.personaliseFeed}
          label={t("privacy.tailorFeed")}
          onChange={(personaliseFeed) =>
            update.mutate(
              { personaliseFeed },
              {
                // Home builds a new list: with the switch off it is the general mix.
                onSuccess: () => {
                  void queryClient.invalidateQueries({ queryKey: ["grid", "feed"] });
                  router.refresh();
                },
              },
            )
          }
        />
      </SwitchRow>
    </div>
  );
}
