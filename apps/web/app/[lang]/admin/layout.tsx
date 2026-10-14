import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { type AdminDashboard, adminDashboardSchema } from "@vinty/shared";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { adminKeys } from "@/lib/admin-keys";
import { ApiClientError, serverApi } from "@/lib/api";
import { getT, isLang } from "@/lib/i18n";
import { loginHref } from "@/lib/login-links";

export const metadata: Metadata = { title: "Back office", robots: { index: false, follow: false } };

/**
 * The guard of the whole /admin area. Before anything is drawn the website asks the server for the dashboard with the
 * visitor's login cookie: the server only answers an admin (401 for a visitor who is logged out, 403 for anyone else).
 * Logged out goes to the log in page and comes back here, a person who is not an admin sees "Admins only", and no admin
 * data reaches the browser in either case. The answer also fills the dashboard's cache, so that page opens at once.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);

  let dashboard: AdminDashboard;
  try {
    dashboard = await serverApi("/v1/admin/dashboard", { lang, schema: adminDashboardSchema });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) redirect(loginHref(lang, `/${lang}/admin`));
    const denied = error instanceof ApiClientError && error.status === 403;
    return (
      <EmptyState
        title={denied ? t("admin.adminsOnly.title") : t("admin.checkFailed.title")}
        message={denied ? t("admin.adminsOnly.message") : t("admin.checkFailed.message")}
      />
    );
  }

  const client = new QueryClient();
  client.setQueryData(adminKeys.dashboard, dashboard);
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <AdminShell lang={lang}>{children}</AdminShell>
    </HydrationBoundary>
  );
}
