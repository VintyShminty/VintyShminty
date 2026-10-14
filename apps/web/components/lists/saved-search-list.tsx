"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savedSearchListSchema } from "@vinty/shared";
import { Bell, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Switch } from "@/components/switch";
import { clientApi } from "@/lib/api-client";

/** One saved search, prepared by the server page: its words, a short line of what is filtered, and the search address. */
export type SavedSearchRow = {
  id: string;
  title: string;
  summary: string;
  href: string;
  notifyOnNew: boolean;
};

type Cache = { items: { id: string; notifyOnNew: boolean }[] };

/** Your saved searches (spec, Saved searches): open one to run it again, switch alerts, delete (with a question first). */
export function SavedSearchList({ initial }: { initial: SavedSearchRow[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<string | null>(null);

  // The alert switches come from the server page and are kept fresh here.
  const live = useQuery({
    queryKey: ["saved-searches"],
    queryFn: () => clientApi("/v1/me/saved-searches", { schema: savedSearchListSchema }),
    staleTime: 60_000,
  });
  const notify = (id: string, fallback: boolean) =>
    live.data?.items.find((s) => s.id === id)?.notifyOnNew ?? fallback;

  const update = useMutation({
    mutationFn: ({ id, notifyOnNew }: { id: string; notifyOnNew: boolean }) =>
      clientApi(`/v1/me/saved-searches/${id}`, { method: "PATCH", body: { notifyOnNew } }),
    onMutate: async ({ id, notifyOnNew }) => {
      await queryClient.cancelQueries({ queryKey: ["saved-searches"] });
      const previous = queryClient.getQueryData<Cache>(["saved-searches"]);
      if (previous) {
        queryClient.setQueryData(["saved-searches"], {
          items: previous.items.map((s) => (s.id === id ? { ...s, notifyOnNew } : s)),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["saved-searches"], context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => clientApi(`/v1/me/saved-searches/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      setRemoved((current) => new Set(current).add(id));
      setAsking(null);
      void queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: () => setAsking(null),
  });

  const rows = initial.filter((row) => !removed.has(row.id));
  if (rows.length === 0) {
    return <EmptyState title={t("savedSearches.empty")} message={t("savedSearches.emptyNote")} />;
  }
  return (
    <div className="max-w-[720px]">
      {update.isError || remove.isError ? <Notice kind="error">{t("errors.general")}</Notice> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="border-b border-border-subtle py-md">
            <Link href={row.href} className="flex items-center gap-md rounded-control py-xs hover:bg-pressed">
              <span className="flex min-w-0 flex-1 flex-col gap-xs">
                <span className="truncate text-body font-semibold text-text-1" dir="auto">
                  {row.title}
                </span>
                {row.summary ? (
                  <span className="line-clamp-2 text-body-sm text-text-3">{row.summary}</span>
                ) : null}
              </span>
              <ChevronRight size={18} aria-hidden className="shrink-0 text-text-4 rtl:-scale-x-100" />
            </Link>
            <div className="mt-md flex items-center gap-md">
              <Bell size={16} aria-hidden className="text-text-3" />
              <span className="flex-1 text-body-sm text-text-2">{t("savedSearches.notify")}</span>
              <Switch
                checked={notify(row.id, row.notifyOnNew)}
                label={t("savedSearches.notify")}
                onChange={(notifyOnNew) => update.mutate({ id: row.id, notifyOnNew })}
              />
              <button
                type="button"
                onClick={() => setAsking(row.id)}
                aria-label={t("savedSearches.delete")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-error hover:bg-pressed"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={asking !== null}
        title={t("savedSearches.deleteTitle")}
        body={t("savedSearches.deleteConfirm")}
        confirmLabel={t("savedSearches.delete")}
        destructive
        busy={remove.isPending}
        onConfirm={() => asking && remove.mutate(asking)}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
