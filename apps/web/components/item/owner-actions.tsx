"use client";

import { useQuery } from "@tanstack/react-query";
import type { ListingDetail } from "@vinty/shared";
import { formatPrice } from "@vinty/shared";
import { Eye, Pencil, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiClientError } from "@/lib/api-error";
import { bumpPlansQuery, useDeleteListing, useGiveBuzz, useListingStatus } from "@/lib/own-listing-queries";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const outline =
  "inline-flex h-11 w-full items-center justify-center gap-sm rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed disabled:opacity-60";

/** The server's refusal to a buzz, in words. */
function buzzErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === "network") return "errors.network";
    if (err.code === "conflict") {
      return err.message.includes("already") ? "buzz.errors.already" : "buzz.errors.unavailable";
    }
  }
  return "errors.general";
}

/** The Buzzing badge with the day and time it ends, written in the viewer's own time zone. */
export function BuzzingNote({ endsAt }: { endsAt: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex items-center gap-sm">
      <Badge variant="accent" icon={Zap} label={t("buzz.buzzing")} />
      <p suppressHydrationWarning className="flex-1 text-body-sm text-text-3">
        {t("buzz.endsOn", { date: formatDateTime(endsAt, i18n.language) })}
      </p>
    </div>
  );
}

/** "Give it buzz": the plans with how long they last and what they cost (Free for now), one confirm. */
function BuzzDialog({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const plans = useQuery({ ...bumpPlansQuery(), enabled: open });
  const give = useGiveBuzz();
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const items = plans.data?.items ?? [];
  const chosen = picked ?? items[0]?.id ?? null;
  const lang = i18n.language === "he" ? "he" : "en";

  const close = () => {
    setPicked(null);
    setErrorKey(null);
    give.reset();
    onClose();
  };
  const confirm = () => {
    if (!chosen) return;
    setErrorKey(null);
    give.mutate(
      { listingId, planId: chosen },
      {
        onSuccess: () => {
          close();
          router.refresh();
        },
        onError: (err) => setErrorKey(buzzErrorKey(err)),
      },
    );
  };

  return (
    <ConfirmDialog
      open={open}
      title={t("buzz.title")}
      body={t("buzz.intro")}
      confirmLabel={t("buzz.confirm")}
      busy={give.isPending}
      disabled={!chosen}
      onConfirm={confirm}
      onCancel={close}
    >
      <div className="mt-lg flex flex-col gap-sm">
        {plans.isPending ? (
          <p role="status" className="text-body-sm text-text-3">
            {t("web.item.buzzLoading")}
          </p>
        ) : plans.isError ? (
          <p role="alert" className="text-body-sm text-error">
            {t("buzz.plansFailed")}
          </p>
        ) : (
          <div role="radiogroup" aria-label={t("buzz.title")} className="flex flex-col gap-sm">
            {items.map((plan) => {
              const selected = plan.id === chosen;
              return (
                <label
                  key={plan.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-md rounded-control border p-md",
                    selected ? "border-primary bg-accent-tint" : "border-border bg-background",
                  )}
                >
                  <input
                    type="radio"
                    name="buzz-plan"
                    checked={selected}
                    onChange={() => setPicked(plan.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="flex-1 text-body font-semibold">{plan.name[lang]}</span>
                  <span className="text-body-sm text-text-2">
                    {plan.priceMinor === 0 ? t("buzz.free") : formatPrice(plan.priceMinor, plan.currency)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {errorKey ? (
          <p role="alert" className="text-body-sm text-error">
            {t(errorKey)}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

/**
 * What you can do with your own listing, the same as the app's own item view: edit (or continue a draft), give it
 * buzz, mark as reserved, hide or show again, mark as sold, delete. Every change asks the server and then refreshes
 * the page, so the status note, the badges and the numbers above come back right.
 */
export function OwnerActions({ listing, lang }: { listing: ListingDetail; lang: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useListingStatus();
  const remove = useDeleteListing();
  const [buzzOpen, setBuzzOpen] = useState(false);
  const [confirming, setConfirming] = useState<"sold" | "delete" | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const busy = status.isPending || remove.isPending;

  const move = (next: UpdateStatus) => {
    setErrorKey(null);
    status.mutate(
      { id: listing.id, status: next },
      {
        onSuccess: () => router.refresh(),
        onError: () => setErrorKey("errors.general"),
        onSettled: () => setConfirming(null),
      },
    );
  };
  const erase = () => {
    setErrorKey(null);
    remove.mutate(listing.id, {
      onSuccess: () => router.push(`/${lang}/profile`),
      onError: () => {
        setErrorKey("errors.general");
        setConfirming(null);
      },
    });
  };

  return (
    <div className="flex flex-col gap-sm">
      {listing.status !== "draft" ? (
        <p className="flex items-center gap-xs text-body-sm text-text-2">
          <Eye size={16} aria-hidden className="text-text-3" />
          {t("listing.views", { count: listing.viewCount })}
          <span aria-hidden className="px-xs text-text-4">
            ·
          </span>
          {t("listing.favourites", { count: listing.favouriteCount })}
        </p>
      ) : null}
      {errorKey ? (
        <p role="alert" className="rounded-control bg-error-tint px-md py-md text-body-sm text-error">
          {t(errorKey)}
        </p>
      ) : null}
      {listing.status === "sold" ? null : (
        <Link
          href={`/${lang}/sell/${listing.id}`}
          className="inline-flex h-12 w-full items-center justify-center gap-sm rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90"
        >
          <Pencil size={18} aria-hidden />
          {listing.status === "draft" ? t("listing.continueEditing") : t("listing.edit")}
        </Link>
      )}
      {listing.status === "active" && !listing.isBumped ? (
        <button type="button" onClick={() => setBuzzOpen(true)} disabled={busy} className={outline}>
          <Zap size={18} aria-hidden className="text-primary" />
          {t("buzz.action")}
        </button>
      ) : null}
      {listing.status === "active" ? (
        <button type="button" onClick={() => move("reserved")} disabled={busy} className={outline}>
          {t("listing.markReserved")}
        </button>
      ) : null}
      {listing.status === "reserved" ? (
        <button type="button" onClick={() => move("active")} disabled={busy} className={outline}>
          {t("listing.unreserve")}
        </button>
      ) : null}
      {listing.status === "active" ? (
        <button type="button" onClick={() => move("hidden")} disabled={busy} className={outline}>
          {t("listing.hide")}
        </button>
      ) : null}
      {listing.status === "hidden" ? (
        <button type="button" onClick={() => move("active")} disabled={busy} className={outline}>
          {t("listing.unhide")}
        </button>
      ) : null}
      {listing.status === "active" || listing.status === "reserved" ? (
        <button type="button" onClick={() => setConfirming("sold")} disabled={busy} className={outline}>
          {t("listing.markSold")}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirming("delete")}
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-sm rounded-control px-lg text-body-sm font-semibold text-error hover:bg-error-tint disabled:opacity-60"
      >
        <Trash2 size={18} aria-hidden />
        {t("listing.delete")}
      </button>

      <BuzzDialog listingId={listing.id} open={buzzOpen} onClose={() => setBuzzOpen(false)} />
      <ConfirmDialog
        open={confirming === "sold"}
        title={t("listing.soldConfirmTitle")}
        body={t("listing.soldConfirm")}
        confirmLabel={t("listing.markSold")}
        busy={busy}
        onConfirm={() => move("sold")}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        title={t("listing.deleteConfirmTitle")}
        body={t("listing.deleteConfirm")}
        confirmLabel={t("listing.delete")}
        destructive
        busy={busy}
        onConfirm={erase}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}

type UpdateStatus = "active" | "hidden" | "reserved" | "sold";
