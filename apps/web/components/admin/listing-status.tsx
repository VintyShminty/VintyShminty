"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_LISTING_STATUSES, type ListingDetail, listingDetailSchema } from "@vinty/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { quietButton } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText } from "@/lib/admin-queries";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SET_LABEL = {
  active: "admin.listings.setActive",
  hidden: "admin.listings.setHidden",
  removed: "admin.listings.setRemoved",
} as const;

/** The strip above the edit form: who sells it, whether it is live, and the hide, remove and put back live buttons. */
export function AdminListingStatus({ listing }: { listing: ListingDetail }) {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const [status, setStatus] = useState<string>(listing.status);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Reserved and sold listings are in the middle of an order, so they are not moved by hand.
  const locked = status === "reserved" || status === "sold";

  const change = useMutation({
    mutationFn: (next: (typeof ADMIN_LISTING_STATUSES)[number]) =>
      clientApi(`/v1/admin/listings/${listing.id}/status`, {
        method: "PATCH",
        body: { status: next },
        schema: listingDetailSchema,
      }),
    onSuccess: (saved) => {
      setStatus(saved.status);
      void client.invalidateQueries({ queryKey: adminKeys.all });
      toast(t("admin.listings.statusSaved", { status: t(`admin.listings.status.${saved.status}`) }));
    },
    onError: (error) => toast(adminErrorText(error, t), "error"),
    onSettled: () => setConfirmRemove(false),
  });

  return (
    <section className="mb-lg flex flex-col gap-md rounded-window border border-border bg-surface p-lg md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-body-sm text-text-3" dir="auto">
          {t("admin.listings.seller", { name: listing.seller.username })}
        </p>
        <p className="text-body font-semibold text-text-1">
          {t("admin.listings.statusTitle")}: {t(`admin.listings.status.${status}`)}
        </p>
        {locked ? <p className="text-body-sm text-text-3">{t("admin.listings.statusLocked")}</p> : null}
      </div>
      {locked ? null : (
        <div className="flex flex-wrap gap-sm">
          {ADMIN_LISTING_STATUSES.filter((s) => s !== status).map((s) => (
            <button
              key={s}
              type="button"
              disabled={change.isPending}
              onClick={() => (s === "removed" ? setConfirmRemove(true) : change.mutate(s))}
              className={cn(quietButton, s === "removed" && "text-error")}
            >
              {t(SET_LABEL[s])}
            </button>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        title={t("admin.listings.removeTitle")}
        body={t("admin.listings.removeBody")}
        confirmLabel={t("admin.listings.setRemoved")}
        destructive
        busy={change.isPending}
        onConfirm={() => change.mutate("removed")}
        onCancel={() => setConfirmRemove(false)}
      />
    </section>
  );
}
