"use client";

import { useTranslation } from "react-i18next";
import { BarColumns, Card, MeterBar, PageTitle, QueryState } from "@/components/admin/ui";
import { aiActionName, formatCount, formatUsd, weekLabel } from "@/lib/admin-format";
import { useAdminAnalytics } from "@/lib/admin-queries";

/** The last 8 weeks of signups, new listings and orders, and what the AI cost this month per feature. */
export function AnalyticsView() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const query = useAdminAnalytics();
  return (
    <>
      <PageTitle title={t("admin.nav.analytics")} />
      <QueryState query={query}>
        {({ weeks, aiThisMonth }) => {
          const charts = [
            { key: "signups", pick: (w: (typeof weeks)[number]) => w.signups },
            { key: "newListings", pick: (w: (typeof weeks)[number]) => w.newListings },
            { key: "orders", pick: (w: (typeof weeks)[number]) => w.orders },
          ] as const;
          const maxCost = Math.max(1, ...aiThisMonth.map((a) => a.costUsdMicros));
          return (
            <div className="flex flex-col gap-xl">
              <p className="text-body-sm text-text-3">{t("admin.analytics.weekNote")}</p>
              <div className="grid gap-md xl:grid-cols-3">
                {charts.map(({ key, pick }) => (
                  <Card key={key} title={t(`admin.analytics.${key}`)}>
                    <BarColumns
                      label={t(`admin.analytics.${key}`)}
                      rows={weeks.map((w) => ({
                        label: weekLabel(w.weekStart, lang),
                        value: pick(w),
                        text: formatCount(pick(w), lang),
                      }))}
                    />
                  </Card>
                ))}
              </div>
              <Card title={t("admin.analytics.aiByFeature")}>
                {aiThisMonth.length === 0 ? (
                  <p className="text-body-sm text-text-3">{t("admin.analytics.noAi")}</p>
                ) : (
                  <ul className="flex flex-col gap-md">
                    {aiThisMonth.map((row) => (
                      <li key={row.action} className="flex flex-col gap-xs">
                        <div className="flex flex-wrap items-baseline justify-between gap-sm">
                          <span className="text-body-sm font-semibold text-text-1">
                            {aiActionName(row.action, t)}
                          </span>
                          <span className="text-body-sm text-text-2">
                            {t("admin.analytics.callsAndCost", {
                              calls: formatCount(row.calls, lang),
                              cost: formatUsd(row.costUsdMicros, lang),
                            })}
                          </span>
                        </div>
                        <MeterBar ratio={row.costUsdMicros / maxCost} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
