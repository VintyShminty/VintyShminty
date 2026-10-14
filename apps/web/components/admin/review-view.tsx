"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AdminReviewItem,
  adminReviewItemSchema,
  formatPrice,
  REVIEW_FILTERS,
  type ReviewAction,
  type ReviewFilter,
} from "@vinty/shared";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { inputClass, LoadFailed, Loading, PageTitle, quietButton } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText, useAdminReview } from "@/lib/admin-queries";
import { cleanNote, reviewActionsFor, sellerHref, URGENCY_CLASS, urgencyTone } from "@/lib/admin-review";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { formatDateTime, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

const rowButton =
  "inline-flex h-9 items-center rounded-control border border-border px-md text-body-sm font-semibold hover:bg-pressed disabled:opacity-60";

function Person({ lang, person }: { lang: string; person: { id: string; username: string } }) {
  return (
    <Link href={sellerHref(lang, person.id)} className="font-semibold text-text-1 underline">
      @{person.username}
    </Link>
  );
}

/** A sentence from the wording with a link in the place of the name: "Seller @tamar" where @tamar opens their page. */
function Sentence({
  text,
  lang,
  person,
}: {
  text: (name: string) => string;
  lang: string;
  person: { id: string; username: string };
}) {
  const marker = "\u0000";
  const [before = "", after = ""] = text(marker).split(marker);
  return (
    <>
      {before}
      <Person lang={lang} person={person} />
      {after}
    </>
  );
}

function TargetBlock({ item, lang }: { item: AdminReviewItem; lang: string }) {
  const { t } = useTranslation();
  const target = item.target;
  if (!target) return <p className="text-body-sm text-text-3">{t("admin.review.gone")}</p>;

  if (target.kind === "listing") {
    const status = t(`admin.upload.items.statuses.${target.status}`, {
      defaultValue: t(`listing.${target.status}`, { defaultValue: target.status }),
    });
    return (
      <div className="flex gap-md">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-control bg-pressed">
          {target.photoUrl ? (
            // biome-ignore lint/performance/noImgElement: a tiny admin thumbnail from the photo store
            <img src={target.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <Link
            href={`/${lang}/item/${target.id}`}
            className="line-clamp-2 text-body font-semibold text-text-1 underline"
          >
            {target.title}
          </Link>
          <p className="text-body-sm text-text-2">
            {target.priceMinor !== null && target.currency
              ? `${formatPrice(target.priceMinor, target.currency)} · `
              : ""}
            <Sentence
              text={(name) => t("admin.review.seller", { name })}
              lang={lang}
              person={target.seller}
            />
          </p>
          <p className="text-card-meta text-text-3">{t("admin.review.listingStatus", { status })}</p>
        </div>
      </div>
    );
  }
  if (target.kind === "user") {
    return (
      <p className="text-body-sm text-text-2">
        <Person lang={lang} person={target} />
      </p>
    );
  }
  return (
    <p className="text-body-sm text-text-2">
      <Sentence text={(name) => t("admin.review.author", { name })} lang={lang} person={target.author} />
    </p>
  );
}

function ReviewCard({ item, lang }: { item: AdminReviewItem; lang: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const tone = urgencyTone(item.urgency);
  const isAi = item.source === "ai_check";
  const actions = reviewActionsFor(item);
  const reason = t(`report.reasons.${item.reason}`);

  const act = useMutation({
    mutationFn: (action: ReviewAction) =>
      clientApi(`/v1/admin/review/${item.id}/action`, {
        method: "POST",
        body: { action, note: cleanNote(note) },
        schema: adminReviewItemSchema,
      }),
    onSuccess: (_, action) => {
      void client.invalidateQueries({ queryKey: adminKeys.reviewAll });
      void client.invalidateQueries({ queryKey: adminKeys.dashboard });
      toast(t(`admin.review.done.${action}`));
    },
    onError: (error) => {
      // Already handled by someone else (or another tab): show the fresh list.
      if (error instanceof ApiClientError && error.status === 409) {
        void client.invalidateQueries({ queryKey: adminKeys.reviewAll });
      }
      toast(adminErrorText(error, t), "error");
    },
    onSettled: () => setConfirming(false),
  });

  const run = (action: ReviewAction) => {
    if (action === "remove_listing") setConfirming(true);
    else act.mutate(action);
  };

  return (
    <li className="flex flex-col gap-md rounded-window border border-border bg-surface p-lg">
      <div className="flex flex-wrap items-center gap-sm">
        <span className={cn("rounded-full px-sm py-px text-badge font-semibold", URGENCY_CLASS[tone])}>
          {t(`admin.review.urgency.${tone}`)}
        </span>
        <span className="inline-flex items-center gap-xs text-body-sm text-text-2">
          {isAi ? <Sparkles size={14} aria-hidden /> : null}
          {t(`admin.review.source.${item.source}`)}
        </span>
        <span className="text-body-sm font-semibold text-text-1">{reason}</span>
        <span
          className="ms-auto text-card-meta text-text-3"
          title={formatDateTime(item.createdAt, i18n.language)}
        >
          {timeAgo(item.createdAt, t)}
        </span>
      </div>

      {item.aiReason && item.aiReason !== item.reason ? (
        <p className="text-body-sm text-text-2">
          {t("admin.review.aiReads", { reason: t(`report.reasons.${item.aiReason}`) })}
        </p>
      ) : null}
      {item.aiSummary ? <p className="text-body-sm text-text-3">{item.aiSummary}</p> : null}
      {item.details ? (
        <p className="text-body-sm text-text-1" dir="auto">
          “{item.details}”
        </p>
      ) : null}
      {item.reporter ? (
        <p className="text-card-meta text-text-3">
          <Sentence
            text={(name) => t("admin.review.reportedBy", { name })}
            lang={lang}
            person={item.reporter}
          />
        </p>
      ) : null}

      <TargetBlock item={item} lang={lang} />

      {item.otherOpenReports > 0 ? (
        <p className="text-card-meta font-semibold text-warning">
          {t("admin.review.otherReports", { count: item.otherOpenReports })}
        </p>
      ) : null}

      {actions.length > 0 ? (
        <div className="flex flex-col gap-sm border-t border-border-subtle pt-md">
          <label className="flex flex-col gap-xs">
            <span className="text-card-meta text-text-3">{t("admin.review.noteLabel")}</span>
            <input
              type="text"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className={cn(inputClass, "w-full")}
            />
          </label>
          <div className="flex flex-wrap gap-sm">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled={act.isPending}
                onClick={() => run(action)}
                className={cn(rowButton, action === "remove_listing" ? "text-error" : "text-text-1")}
              >
                {t(`admin.review.actions.${action}`)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-xs border-t border-border-subtle pt-md">
          <p className="text-body-sm font-semibold text-text-1">
            {t(`admin.review.status.${item.status}`)}
            {item.handledAt ? ` · ${formatDateTime(item.handledAt, i18n.language)}` : ""}
          </p>
          {item.resolutionNote ? (
            <p className="text-body-sm text-text-2" dir="auto">
              {t("admin.review.handledNote", { note: item.resolutionNote })}
            </p>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={t("admin.review.actions.remove_listing")}
        body={t("admin.review.confirmRemove")}
        confirmLabel={t("admin.review.actions.remove_listing")}
        destructive
        busy={act.isPending}
        onConfirm={() => act.mutate("remove_listing")}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}

/** Member reports and AI listing checks in one list, most urgent first. The AI only flags, these buttons are the decision. */
export function ReviewView() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "he" ? "he" : "en";
  const [filter, setFilter] = useState<ReviewFilter>("open");
  const query = useAdminReview(filter);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageTitle title={t("admin.review.title")} />
      <p className="-mt-md mb-lg text-body-sm text-text-3">{t("admin.review.intro")}</p>
      <fieldset className="m-0 mb-lg flex min-w-0 flex-wrap gap-sm border-0 p-0">
        <legend className="sr-only">{t("admin.review.title")}</legend>
        {REVIEW_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-md text-body-sm font-semibold",
              filter === f
                ? "border-transparent bg-chip-selected text-on-chip"
                : "border-text-4 text-text-2 hover:bg-pressed",
            )}
          >
            {t(`admin.review.filters.${f}`)}
          </button>
        ))}
      </fieldset>

      {query.data === undefined ? (
        query.isError ? (
          <LoadFailed onRetry={() => void query.refetch()} />
        ) : (
          <Loading />
        )
      ) : items.length === 0 ? (
        <p className="py-2xl text-center text-body-sm text-text-3">{t(`admin.review.empty.${filter}`)}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-md">
            {items.map((item) => (
              <ReviewCard key={item.id} item={item} lang={lang} />
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
                {t("admin.review.loadMore")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
