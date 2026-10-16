"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AdminListingRow, LISTING_TITLE_MAX } from "@vinty/shared";
import { Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { inputClass, LoadFailed, Loading, PageTitle, quietButton } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText, useAdminListings } from "@/lib/admin-queries";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { formatDate } from "@/lib/time";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

function money(minor: number | null, currency: string, language: string): string | null {
  if (minor === null) return null;
  try {
    return new Intl.NumberFormat(language, { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${minor / 100} ${currency}`;
  }
}

function ListingRow({ item, lang }: { item: AdminListingRow; lang: string }) {
  const { t, i18n } = useTranslation();
  const price = money(item.priceMinor, item.currency, i18n.language);
  const quiet = item.status === "hidden";
  const toast = useToast();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasOrder, setHasOrder] = useState(false);
  const done = () => void client.invalidateQueries({ queryKey: adminKeys.all });

  const rename = useMutation({
    mutationFn: (title: string) =>
      clientApi(`/v1/admin/listings/${item.id}`, { method: "PATCH", body: { title } }),
    onSuccess: () => {
      setEditing(false);
      done();
      toast(t("admin.listings.renamed"));
    },
    onError: (error) => toast(adminErrorText(error, t), "error"),
  });
  const del = useMutation({
    mutationFn: () => clientApi(`/v1/admin/listings/${item.id}`, { method: "DELETE" }),
    onSuccess: () => {
      done();
      toast(t("admin.listings.deleted"));
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 409) setHasOrder(true);
      else toast(adminErrorText(error, t), "error");
    },
    onSettled: () => setConfirmDelete(false),
  });
  const remove = useMutation({
    mutationFn: () =>
      clientApi(`/v1/admin/listings/${item.id}/status`, { method: "PATCH", body: { status: "removed" } }),
    onSuccess: () => {
      done();
      toast(t("admin.listings.statusSaved", { status: t("admin.listings.status.removed") }));
    },
    onError: (error) => toast(adminErrorText(error, t), "error"),
  });

  const save = () => {
    const title = draft.trim();
    if (!title || title === item.title) setEditing(false);
    else rename.mutate(title);
  };
  const startEdit = () => {
    setDraft(item.title);
    setEditing(true);
  };
  const busy = rename.isPending || del.isPending || remove.isPending;

  return (
    <li className="flex flex-wrap items-center gap-md rounded-window border border-border bg-surface p-md">
      {item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-control bg-pressed object-cover"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-control bg-pressed" />
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-wrap items-center gap-sm">
            <input
              // biome-ignore lint/a11y/noAutofocus: the field appears because the admin asked to rename
              autoFocus
              value={draft}
              maxLength={LISTING_TITLE_MAX}
              aria-label={t("admin.listings.rename")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              dir="auto"
              className={cn(inputClass, "min-w-0 flex-1")}
            />
            <button type="button" disabled={busy} onClick={save} className={quietButton}>
              {t("admin.listings.renameSave")}
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className={quietButton}>
              {t("admin.listings.renameCancel")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-sm">
            <p className="truncate text-body font-semibold text-text-1" dir="auto">
              {item.title}
            </p>
            <button
              type="button"
              onClick={startEdit}
              aria-label={t("admin.listings.rename")}
              className="shrink-0 rounded-control p-xs text-text-3 hover:bg-pressed"
            >
              <Pencil size={14} aria-hidden />
            </button>
          </div>
        )}
        <p className="truncate text-body-sm text-text-3" dir="auto">
          {t("admin.listings.by", { name: item.sellerUsername ?? "" })}
          {" · "}
          {price ?? t("admin.listings.noPrice")}
          {" · "}
          {formatDate(item.createdAt, i18n.language)}
        </p>
        <span
          className={cn(
            "mt-xs inline-block rounded-full px-sm py-px text-badge font-semibold",
            quiet ? "bg-warning-tint text-warning" : "bg-chip-selected text-on-chip",
          )}
        >
          {t(`admin.listings.status.${item.status}`)}
        </span>
      </div>
      <Link href={`/${lang}/admin/listings/${item.id}`} className={quietButton}>
        {t("admin.listings.edit")}
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirmDelete(true)}
        aria-label={t("admin.listings.delete")}
        className={cn(quietButton, "gap-xs text-error")}
      >
        <Trash2 size={14} aria-hidden />
        {t("admin.listings.delete")}
      </button>
      {hasOrder ? (
        <div className="flex basis-full flex-wrap items-center gap-sm text-body-sm text-text-3">
          <span>{t("admin.listings.deleteHasOrder")}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => remove.mutate()}
            className={cn(quietButton, "text-error")}
          >
            {t("admin.listings.setRemoved")}
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title={t("admin.listings.deleteTitle")}
        body={t("admin.listings.deleteBody")}
        confirmLabel={t("admin.listings.delete")}
        destructive
        busy={del.isPending}
        onConfirm={() => del.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  );
}

/** Every listing, newest first, found by title or seller username, each with an Edit button. */
export function ListingsView() {
  const { t } = useTranslation();
  const { lang } = useParams<{ lang: string }>();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const query = useAdminListings(q);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageTitle title={t("admin.nav.listings")} />
      <label className="relative mb-lg block md:w-96">
        <span className="sr-only">{t("admin.listings.search")}</span>
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute start-md top-1/2 -translate-y-1/2 text-text-3"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.listings.search")}
          className={cn(inputClass, "w-full ps-[38px]")}
        />
      </label>

      {query.data === undefined ? (
        query.isError ? (
          <LoadFailed onRetry={() => void query.refetch()} />
        ) : (
          <Loading />
        )
      ) : items.length === 0 ? (
        <p className="py-2xl text-center text-body-sm text-text-3">{t("admin.listings.empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-sm">
            {items.map((item) => (
              <ListingRow key={item.id} item={item} lang={lang} />
            ))}
          </ul>
          {query.hasNextPage ? (
            <div className="mt-lg flex justify-center">
              <button
                type="button"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                className={quietButton}
              >
                {t("admin.listings.loadMore")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
