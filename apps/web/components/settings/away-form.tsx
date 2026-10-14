"use client";

import { Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { Chip } from "@/components/chip";
import { SectionLabel, SwitchRow } from "@/components/settings/page-head";
import { Switch } from "@/components/switch";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { formatDate } from "@/lib/time";

const DAY_MS = 86_400_000;
/** Ready made return dates. The server allows up to 90 days. */
const PRESETS = [
  { key: "week1", days: 7 },
  { key: "week2", days: 14 },
  { key: "month1", days: 30 },
  { key: "month2", days: 60 },
] as const;

type Away = { enabled: boolean; endsAt: string | null };

/**
 * Settings, Away mode (D-025). A switch and an optional return date, picked from ready made choices like the app. No
 * date means away until you switch it off. Your items are left out of Home and search while it is on.
 */
export function AwayForm({ initial }: { initial: Away }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [away, setAway] = useState<Away>(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const save = async (input: { enabled: boolean; endsAt?: string | null }) => {
    setFailed(null);
    setBusy(true);
    try {
      const result = await clientApi<{ enabled: boolean; endsAt: string | null }>("/v1/me/away-mode", {
        method: "PUT",
        body: input,
      });
      setAway({ enabled: result.enabled, endsAt: result.endsAt });
      router.refresh();
    } catch (error) {
      setFailed(
        error instanceof ApiClientError && error.fields?.endsAt ? t(error.fields.endsAt) : t("away.failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {failed ? <Notice kind="error">{failed}</Notice> : null}
      <SwitchRow label={t("away.title")} hint={t("away.switchHint")}>
        <Switch
          checked={away.enabled}
          disabled={busy}
          label={t("away.title")}
          onChange={(enabled) => void save({ enabled })}
        />
      </SwitchRow>
      {away.enabled ? (
        <>
          <p className="mt-md flex items-center gap-sm text-body-sm text-text-2">
            <Moon size={16} aria-hidden className="shrink-0 text-text-3" />
            {away.endsAt
              ? t("away.statusUntil", { date: formatDate(away.endsAt, i18n.language) })
              : t("away.statusOpen")}
          </p>
          <SectionLabel>{t("away.backOn")}</SectionLabel>
          <div className="flex flex-wrap gap-sm">
            {PRESETS.map(({ key, days }) => (
              <Chip
                key={key}
                label={t(`away.preset.${key}`)}
                disabled={busy}
                onClick={() =>
                  void save({ enabled: true, endsAt: new Date(Date.now() + days * DAY_MS).toISOString() })
                }
              />
            ))}
            <Chip
              label={t("away.preset.none")}
              selected={!away.endsAt}
              disabled={busy}
              onClick={() => void save({ enabled: true, endsAt: null })}
            />
          </div>
          <p className="mt-sm text-card-desc text-text-3">{t("away.backOnHint")}</p>
        </>
      ) : null}
    </div>
  );
}
