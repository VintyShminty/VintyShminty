"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  type AdminAnalytics,
  type AdminDashboard,
  type AdminExpenses,
  type AdminSecurity,
  type AdminUsersPage,
  adminAnalyticsSchema,
  adminDashboardSchema,
  adminExpensesSchema,
  adminSecuritySchema,
  adminUsersPageSchema,
} from "@vinty/shared";
import type { TFunction } from "i18next";
import { adminKeys } from "@/lib/admin-keys";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { describeApiError } from "@/lib/describe-api-error";

// The 30 second wait comes from the website's query setup (lib/query-client.ts), so jumping between pages is instant.

export const useAdminDashboard = () =>
  useQuery<AdminDashboard>({
    queryKey: adminKeys.dashboard,
    queryFn: () => clientApi("/v1/admin/dashboard", { schema: adminDashboardSchema }),
  });

export const useAdminAnalytics = () =>
  useQuery<AdminAnalytics>({
    queryKey: adminKeys.analytics,
    queryFn: () => clientApi("/v1/admin/analytics", { schema: adminAnalyticsSchema }),
  });

export const useAdminSecurity = () =>
  useQuery<AdminSecurity>({
    queryKey: adminKeys.security,
    queryFn: () => clientApi("/v1/admin/security", { schema: adminSecuritySchema }),
  });

export const useAdminExpenses = (month: string) =>
  useQuery<AdminExpenses>({
    queryKey: adminKeys.expenses(month),
    queryFn: () => clientApi(`/v1/admin/expenses?month=${month}`, { schema: adminExpensesSchema }),
  });

export function useAdminUsers(filter: string, q: string) {
  return useInfiniteQuery<
    AdminUsersPage,
    Error,
    { pages: AdminUsersPage[] },
    readonly unknown[],
    string | null
  >({
    queryKey: adminKeys.users(filter, q),
    initialPageParam: null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ filter, limit: "20" });
      if (q) params.set("q", q);
      if (pageParam) params.set("cursor", pageParam);
      return clientApi(`/v1/admin/users?${params}`, { schema: adminUsersPageSchema });
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** The words for a failed admin call. The server's own sentence for a refusal such as "ban them instead", else the usual wording. */
export function adminErrorText(error: unknown, t: TFunction): string {
  if (error instanceof ApiClientError) {
    if ((error.status === 409 || error.status === 400) && error.message) return error.message;
    if (error.status === 403) return t("admin.errors.notAllowed");
  }
  return t(describeApiError(error).key);
}
