import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SwitchRow } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { TopBar } from "@/components/ui/top-bar";
import { settingsQuery, useUpdateSettings } from "@/lib/queries";

/** Settings, Privacy. Only what works today: the Last seen line on your About tab. */
export default function Privacy() {
  const { t } = useTranslation();
  const { data: settings } = useQuery(settingsQuery());
  const update = useUpdateSettings();
  return (
    <Screen>
      <TopBar title={t("privacy.title")} />
      {settings ? (
        <SwitchRow
          label={t("privacy.showLastSeen")}
          description={t("privacy.showLastSeenHint")}
          checked={settings.showLastSeen}
          onCheckedChange={(showLastSeen) => update.mutate({ showLastSeen })}
          last
        />
      ) : (
        <Spinner />
      )}
    </Screen>
  );
}
