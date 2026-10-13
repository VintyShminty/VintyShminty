import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SwitchRow } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { TopBar } from "@/components/ui/top-bar";
import { settingsQuery, useUpdateSettings } from "@/lib/queries";

/** Settings, Privacy: the Last seen line on your About tab and the switch that lets Home learn from what you do. */
export default function Privacy() {
  const { t } = useTranslation();
  const { data: settings } = useQuery(settingsQuery());
  const update = useUpdateSettings();
  const queryClient = useQueryClient();
  return (
    <Screen>
      <TopBar title={t("privacy.title")} />
      {settings ? (
        <>
          <SwitchRow
            label={t("privacy.showLastSeen")}
            description={t("privacy.showLastSeenHint")}
            checked={settings.showLastSeen}
            onCheckedChange={(showLastSeen) => update.mutate({ showLastSeen })}
          />
          <SwitchRow
            label={t("privacy.tailorFeed")}
            description={t("privacy.tailorFeedHint")}
            checked={settings.personaliseFeed}
            onCheckedChange={(personaliseFeed) =>
              update.mutate(
                { personaliseFeed },
                // Home builds a new list: with the switch off it is the general mix.
                { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["feed"] }) },
              )
            }
            last
          />
        </>
      ) : (
        <Spinner />
      )}
    </Screen>
  );
}
