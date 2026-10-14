"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AdminSecurity, type KillSwitch, killSwitchSchema } from "@vinty/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { Card, MeterBar, PageTitle, QueryState } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatUsd, relativeTime } from "@/lib/admin-format";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText, useAdminSecurity } from "@/lib/admin-queries";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function SpendMeter({ label, used, cap, lang }: { label: string; used: number; cap: number; lang: string }) {
  const { t } = useTranslation();
  const ratio = cap > 0 ? used / cap : 0;
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <span className="text-body-sm font-semibold text-text-1">{label}</span>
        <span className="text-body-sm text-text-2">
          {t("admin.security.ofCap", { used: formatUsd(used, lang), cap: formatUsd(cap, lang) })}
        </span>
      </div>
      <MeterBar ratio={ratio} tone={ratio >= 1 ? "error" : ratio >= 0.8 ? "warning" : "primary"} />
    </div>
  );
}

function SwitchRow({ item, lang }: { item: KillSwitch; lang: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const name = t(`admin.security.switches.${item.name}.name`, { defaultValue: item.name });

  const flip = useMutation({
    mutationFn: (enabled: boolean) =>
      clientApi(`/v1/admin/switches/${item.name}`, {
        method: "PUT",
        body: { enabled },
        schema: killSwitchSchema,
      }),
    onSuccess: (saved) => {
      client.setQueryData<AdminSecurity>(adminKeys.security, (old) =>
        old ? { ...old, switches: old.switches.map((s) => (s.name === saved.name ? saved : s)) } : old,
      );
      void client.invalidateQueries({ queryKey: adminKeys.dashboard });
      toast(t(saved.enabled ? "admin.security.switchedOn" : "admin.security.switchedOff", { name }));
    },
    onError: (error) => toast(adminErrorText(error, t), "error"),
    onSettled: () => setConfirming(false),
  });

  const onToggle = () => {
    if (item.enabled) setConfirming(true);
    else flip.mutate(true);
  };

  return (
    <li className="flex flex-col gap-sm py-md sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-body font-semibold text-text-1">{name}</p>
        <p className="text-body-sm text-text-3">
          {t(`admin.security.switches.${item.name}.what`, { defaultValue: "" })}
        </p>
        <p className="mt-xs text-card-meta text-text-3">
          {item.changedAt
            ? t("admin.security.changed", { when: relativeTime(item.changedAt, lang) })
            : t("admin.security.neverChanged")}
          {item.reason ? ` · ${t("admin.security.reason", { reason: item.reason })}` : ""}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={item.enabled}
        aria-label={name}
        disabled={flip.isPending}
        onClick={onToggle}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-sm self-start rounded-full px-md text-body-sm font-semibold disabled:opacity-60",
          item.enabled ? "bg-success-tint text-success" : "bg-error-tint text-error",
        )}
      >
        <span
          aria-hidden
          className={cn("h-2.5 w-2.5 rounded-full", item.enabled ? "bg-success" : "bg-error")}
        />
        {item.enabled ? t("admin.security.on") : t("admin.security.off")}
      </button>
      <ConfirmDialog
        open={confirming}
        title={t("admin.security.confirmOffTitle", { name })}
        body={t("admin.security.confirmOffBody")}
        confirmLabel={t("admin.security.turnOff")}
        destructive
        busy={flip.isPending}
        onConfirm={() => flip.mutate(false)}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}

/** AI spend against its caps and the kill switches. */
export function SecurityView() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const query = useAdminSecurity();
  return (
    <>
      <PageTitle title={t("admin.nav.security")} />
      <QueryState query={query}>
        {({ aiSpend, switches }) => (
          <div className="flex flex-col gap-xl">
            <Card title={t("admin.security.spendTitle")}>
              <div className="flex flex-col gap-lg">
                <SpendMeter
                  label={t("admin.security.thisHour")}
                  used={aiSpend.thisHourUsdMicros}
                  cap={aiSpend.hourlyCapUsdMicros}
                  lang={lang}
                />
                <SpendMeter
                  label={t("admin.security.today")}
                  used={aiSpend.todayUsdMicros}
                  cap={aiSpend.dailyCapUsdMicros}
                  lang={lang}
                />
                <p className="text-card-meta text-text-3">{t("admin.security.capNote")}</p>
              </div>
            </Card>
            <Card title={t("admin.security.switchesTitle")}>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {switches.map((item) => (
                  <SwitchRow key={item.name} item={item} lang={lang} />
                ))}
              </ul>
            </Card>
          </div>
        )}
      </QueryState>
    </>
  );
}
