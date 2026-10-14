"use client";

import { Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { clientApi } from "@/lib/api-client";
import { formatDate } from "@/lib/time";

/** Shown on your own profile while Away mode is on, with the way back (D-025): "I'm back" switches it off. */
export function AwayStrip({ endsAt }: { endsAt: string | null }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const back = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await clientApi("/v1/me/away-mode", { method: "PUT", body: { enabled: false } });
      router.refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="mt-lg flex flex-wrap items-center gap-md rounded-control bg-accent-tint p-md">
      <Moon size={20} aria-hidden className="shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-body-sm text-text-1">
        {failed
          ? t("away.failed")
          : endsAt
            ? t("away.bannerUntil", { date: formatDate(endsAt, i18n.language) })
            : t("away.bannerOpen")}
      </p>
      <button
        type="button"
        onClick={back}
        disabled={busy}
        className="inline-flex h-9 items-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
      >
        {t("away.bannerButton")}
      </button>
    </div>
  );
}
