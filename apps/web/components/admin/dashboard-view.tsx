"use client";

import { useTranslation } from "react-i18next";
import { Card, PageTitle, QueryState, StatCard } from "@/components/admin/ui";
import { describeAction, formatCount, formatUsd, relativeTime } from "@/lib/admin-format";
import { useAdminDashboard } from "@/lib/admin-queries";

/** The first page of the back office: the numbers that matter today and the last 20 things admins (or the system) did. */
export function DashboardView() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const query = useAdminDashboard();
  return (
    <>
      <PageTitle title={t("admin.title")} />
      <QueryState query={query}>
        {({ stats, recentActions }) => (
          <div className="flex flex-col gap-xl">
            <div className="grid grid-cols-2 gap-md lg:grid-cols-3">
              <StatCard label={t("admin.dashboard.totalUsers")} value={formatCount(stats.totalUsers, lang)} />
              <StatCard
                label={t("admin.dashboard.newUsers")}
                value={formatCount(stats.newUsersLast7Days, lang)}
                note={t("admin.dashboard.last7Days")}
              />
              <StatCard
                label={t("admin.dashboard.activeListings")}
                value={formatCount(stats.activeListings, lang)}
              />
              <StatCard
                label={t("admin.dashboard.orders")}
                value={formatCount(stats.ordersLast30Days, lang)}
                note={t("admin.dashboard.last30Days")}
              />
              <StatCard
                label={t("admin.dashboard.aiSpend")}
                value={formatUsd(stats.aiSpendThisMonthUsdMicros, lang)}
                note={t("admin.dashboard.thisMonth")}
              />
              <StatCard
                label={t("admin.dashboard.aiCalls")}
                value={formatCount(stats.aiCallsToday, lang)}
                note={t("admin.dashboard.today")}
              />
            </div>
            <Card title={t("admin.dashboard.recentActivity")}>
              {recentActions.length === 0 ? (
                <p className="text-body-sm text-text-3">{t("admin.dashboard.noActivity")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border-subtle">
                  {recentActions.map((action) => (
                    <li key={action.id} className="flex items-start justify-between gap-md py-sm">
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold text-text-1">{describeAction(action, t)}</p>
                        <p className="text-card-meta text-text-3">
                          {action.adminUsername
                            ? t("admin.dashboard.by", { name: action.adminUsername })
                            : t("admin.dashboard.bySystem")}
                        </p>
                      </div>
                      <time dateTime={action.createdAt} className="shrink-0 text-card-meta text-text-3">
                        {relativeTime(action.createdAt, lang)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </QueryState>
    </>
  );
}
