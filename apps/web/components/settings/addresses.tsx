"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { AddressForm } from "@/components/checkout/address-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { type Address, addressesQuery, useDeleteAddress } from "@/lib/order-flow-queries";

const LIMIT = 10;

/** Settings, Addresses: the delivery addresses saved on this account. Add, change (same form as checkout) and delete. */
export function AddressesManager() {
  const { t } = useTranslation();
  const query = useQuery(addressesQuery());
  const remove = useDeleteAddress();
  // null: the list. "new": the form for a new address. An address: the form to change it.
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const rows = query.data ?? [];

  if (editing) {
    return (
      <div>
        <h2 className="mb-lg text-heading font-bold text-text-1">
          {editing === "new" ? t("address.addTitle") : t("address.editTitle")}
        </h2>
        <AddressForm
          address={editing === "new" ? undefined : editing}
          defaultIsDefault={rows.length === 0}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div>
      {query.isPending ? (
        <div className="flex justify-center py-2xl" role="status" aria-label={t("web.inbox.loading")}>
          <Loader2 size={28} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
        </div>
      ) : query.isError && rows.length === 0 ? (
        <div className="flex flex-col items-start gap-md">
          <p className="text-body-sm text-error">{t("errors.loadFailed")}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="inline-flex h-11 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
          >
            {t("common.tryAgain")}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t("address.emptyTitle")} message={t("address.emptyNote")} />
      ) : (
        <ul>
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-md border-b border-border-subtle py-md">
              <MapPin size={20} className="shrink-0 text-text-2" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-xs text-start">
                <span className="flex flex-wrap items-center gap-sm">
                  <span className="truncate text-body font-semibold text-text-1">
                    {a.label || a.fullName}
                  </span>
                  {a.isDefault ? <Badge variant="neutral" icon={Check} label={t("address.default")} /> : null}
                </span>
                {a.label ? <span className="truncate text-body-sm text-text-3">{a.fullName}</span> : null}
                <span className="truncate text-body-sm text-text-3">
                  {[a.line1, a.line2].filter(Boolean).join(" ")}
                </span>
                <span className="truncate text-body-sm text-text-3">
                  {a.postcode} {a.city}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditing(a)}
                aria-label={`${t("address.editTitle")}: ${a.label || a.fullName}`}
                className="px-sm py-xs text-body-sm font-semibold text-primary hover:underline"
              >
                {t("checkout.change")}
              </button>
              <button
                type="button"
                onClick={() => setDeleting(a)}
                aria-label={`${t("address.delete")}: ${a.label || a.fullName}`}
                className="px-sm py-xs text-body-sm font-semibold text-error hover:underline"
              >
                {t("address.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-xl">
        <button
          type="button"
          disabled={rows.length >= LIMIT}
          onClick={() => setEditing("new")}
          className="inline-flex h-12 w-full items-center justify-center gap-sm rounded-control border border-primary px-lg text-body font-semibold text-primary hover:bg-accent-tint disabled:opacity-60"
        >
          <Plus size={18} aria-hidden />
          {t("address.add")}
        </button>
        {rows.length >= LIMIT ? (
          <p className="mt-sm text-center text-card-desc text-text-3">{t("address.limit")}</p>
        ) : null}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title={t("address.deleteTitle")}
        body={t("address.deleteNote")}
        confirmLabel={t("address.delete")}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
