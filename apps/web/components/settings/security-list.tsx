"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Check, Laptop, Smartphone } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { Badge } from "@/components/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getAuthClient } from "@/lib/auth-client";
import { timeAgo } from "@/lib/time";

type SessionRow = {
  id: string;
  token: string;
  userAgent?: string | null;
  updatedAt: Date | string;
};

/** "Chrome on macOS" from a browser's long description. The app's own "Vinty/1.0 (iPhone 17 Pro; iOS 26.0)" gives "iPhone 17 Pro". */
function describeDevice(userAgent: string | null | undefined, t: TFunction) {
  if (!userAgent) return { name: t("security.unknownDevice"), phone: false };
  if (userAgent.startsWith("Vinty/")) {
    return { name: userAgent.match(/\(([^;)]+)/)?.[1]?.trim() || t("security.unknownDevice"), phone: true };
  }
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : null;
  const system = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Windows/.test(userAgent)
            ? "Windows"
            : /Linux/.test(userAgent)
              ? "Linux"
              : null;
  const phone = system === "iPhone" || system === "Android" || system === "iPad";
  if (browser && system) return { name: t("web.settings.deviceOn", { browser, system }), phone };
  return { name: browser ?? system ?? t("security.unknownDevice"), phone };
}

/** Settings, Sign in and safety: where you are logged in, with Log out for one device or all the others (Better Auth). */
export function SecurityList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const client = getAuthClient();
      const [list, current] = await Promise.all([client.listSessions(), client.getSession()]);
      if (list.error) throw new Error(list.error.message);
      return {
        rows: (list.data ?? []) as SessionRow[],
        currentToken: current.data?.session.token ?? null,
      };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sessions"] });
  const revoke = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await getAuthClient().revokeSession({ token });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
  const revokeOthers = useMutation({
    mutationFn: async () => {
      const { error } = await getAuthClient().revokeOtherSessions();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setConfirming(false);
      return refresh();
    },
  });

  if (sessions.isPending) return <p className="py-lg text-body-sm text-text-3">{t("web.feed.loading")}</p>;
  if (sessions.isError || !sessions.data) return <Notice kind="error">{t("errors.loadFailed")}</Notice>;

  const { rows, currentToken } = sessions.data;
  const ordered = [...rows].sort((a, b) =>
    a.token === currentToken ? -1 : b.token === currentToken ? 1 : 0,
  );
  const others = rows.filter((s) => s.token !== currentToken);

  return (
    <div>
      {revoke.isError || revokeOthers.isError ? <Notice kind="error">{t("errors.general")}</Notice> : null}
      <ul>
        {ordered.map((s) => {
          const current = s.token === currentToken;
          const { name, phone } = describeDevice(s.userAgent, t);
          const Icon = phone ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex min-h-16 items-center gap-md border-b border-border-subtle py-md">
              <Icon size={22} aria-hidden className="shrink-0 text-text-2" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-text-1">{name}</p>
                <p className="text-card-meta text-text-3">
                  {current ? t("security.activeNow") : timeAgo(new Date(s.updatedAt).toISOString(), t)}
                </p>
              </div>
              {current ? (
                <Badge variant="success" icon={Check} label={t("security.thisDevice")} />
              ) : (
                <button
                  type="button"
                  disabled={revoke.isPending && revoke.variables === s.token}
                  onClick={() => revoke.mutate(s.token)}
                  className="inline-flex h-9 items-center rounded-control border border-primary px-md text-body-sm font-semibold text-primary hover:bg-accent-tint disabled:opacity-40"
                >
                  {t("security.logOutDevice")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-lg inline-flex h-11 items-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
        >
          {t("security.logOutOthers")}
        </button>
      ) : (
        <p className="pt-md text-body-sm text-text-3">{t("web.settings.onlyThisBrowser")}</p>
      )}
      <ConfirmDialog
        open={confirming}
        title={t("security.logOutOthersTitle")}
        body={t("web.settings.logOutOthersBody")}
        confirmLabel={t("security.logOutOthers")}
        destructive
        busy={revokeOthers.isPending}
        onConfirm={() => revokeOthers.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
