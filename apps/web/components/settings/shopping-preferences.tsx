"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type HiddenItem,
  hiddenListSchema,
  PERSONALISATION_SIZES_MAX,
  personalisationSizesSchema,
} from "@vinty/shared";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { Chip } from "@/components/chip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionLabel } from "@/components/settings/page-head";
import { clientApi } from "@/lib/api-client";
import { describeApiError } from "@/lib/describe-api-error";
import type { FilterOptions } from "@/lib/filters";

type Props = {
  lang: string;
  groups: FilterOptions["sizeGroups"];
  initialSizeIds: string[];
  initialHidden: HiddenItem[];
};

/**
 * Settings, Shopping preferences (D-022, D-029): the sizes Home puts first, "Answer the welcome questions again", the
 * list of things hidden from Home with Undo, and Reset my recommendations. Same words and calls as the app.
 */
export function ShoppingPreferences({ lang, groups, initialSizeIds, initialHidden }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const sizesDialog = useRef<HTMLDialogElement>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const sizes = useQuery({
    queryKey: ["personalisation-sizes"],
    queryFn: () => clientApi("/v1/me/personalisation/sizes", { schema: personalisationSizesSchema }),
    initialData: { sizeIds: initialSizeIds },
    staleTime: 60_000,
  });
  const saveSizes = useMutation({
    mutationFn: (sizeIds: string[]) =>
      clientApi("/v1/me/personalisation/sizes", {
        method: "PUT",
        body: { sizeIds },
        schema: personalisationSizesSchema,
      }),
    onMutate: async (sizeIds) => {
      await queryClient.cancelQueries({ queryKey: ["personalisation-sizes"] });
      const previous = queryClient.getQueryData(["personalisation-sizes"]);
      queryClient.setQueryData(["personalisation-sizes"], { sizeIds });
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(["personalisation-sizes"], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-sizes"] });
      // Home shows the new sizes the next time the list is built.
      void queryClient.invalidateQueries({ queryKey: ["grid", "feed"], refetchType: "none" });
    },
  });

  const hidden = useQuery({
    queryKey: ["feed-hidden"],
    queryFn: () => clientApi("/v1/feed/hidden", { schema: hiddenListSchema }),
    initialData: { items: initialHidden },
    staleTime: 0,
  });
  const undo = useMutation({
    mutationFn: (id: string) => clientApi(`/v1/feed/hidden/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["feed-hidden"] });
      const previous = queryClient.getQueryData<{ items: HiddenItem[] }>(["feed-hidden"]);
      if (previous)
        queryClient.setQueryData(["feed-hidden"], { items: previous.items.filter((i) => i.id !== id) });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["feed-hidden"], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed-hidden"] });
      void queryClient.invalidateQueries({ queryKey: ["grid", "feed"], refetchType: "none" });
    },
  });

  const reset = useMutation({
    mutationFn: () => clientApi("/v1/me/personalisation", { method: "DELETE" }),
    onSuccess: () => {
      setResetting(false);
      setResetDone(true);
      void queryClient.invalidateQueries({ queryKey: ["grid", "feed"] });
      router.refresh();
    },
    onError: () => setResetting(false),
  });

  const sizeIds = sizes.data.sizeIds;
  const hiddenLabel = (item: HiddenItem) =>
    item.label ?? item.categoryName?.[lang === "he" ? "he" : "en"] ?? t("shopping.hiddenUnknown");
  const toggle = (id: string) => {
    const next = sizeIds.includes(id)
      ? sizeIds.filter((x) => x !== id)
      : sizeIds.length < PERSONALISATION_SIZES_MAX
        ? [...sizeIds, id]
        : sizeIds;
    if (next !== sizeIds) saveSizes.mutate(next);
  };

  // The browser's dialog closes on Escape by itself. Keep the page from scrolling behind it while it is open.
  useEffect(() => {
    const el = sizesDialog.current;
    if (!el) return;
    const onClose = () => document.body.classList.remove("overflow-hidden");
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  const rowClass =
    "flex min-h-14 w-full items-center gap-md border-b border-border-subtle text-start text-body-sm hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";
  return (
    <div>
      {saveSizes.isError ? <Notice kind="error">{t(describeApiError(saveSizes.error).key)}</Notice> : null}
      {resetDone ? <Notice kind="success">{t("shopping.resetDone")}</Notice> : null}
      {reset.isError ? <Notice kind="error">{t("errors.general")}</Notice> : null}

      <SectionLabel>{t("shopping.sizes")}</SectionLabel>
      <button
        type="button"
        onClick={() => {
          document.body.classList.add("overflow-hidden");
          sizesDialog.current?.showModal();
        }}
        className={rowClass}
      >
        <span className="flex-1 font-semibold text-text-1">{t("shopping.pick")}</span>
        <span className="text-text-3">
          {sizeIds.length === 0 ? t("shopping.none") : t("shopping.count", { count: sizeIds.length })}
        </span>
        <ChevronRight size={16} aria-hidden className="text-text-4 rtl:-scale-x-100" />
      </button>
      <p className="pt-sm text-card-desc text-text-3">{t("shopping.sizesNote")}</p>

      <div className="mt-xl">
        <Link
          href={`/${lang}/welcome-questions?next=${encodeURIComponent(`/${lang}/settings/shopping`)}`}
          className={rowClass}
        >
          <span className="flex-1 font-semibold text-text-1">{t("shopping.redo")}</span>
          <ChevronRight size={16} aria-hidden className="text-text-4 rtl:-scale-x-100" />
        </Link>
        <p className="pt-sm text-card-desc text-text-3">{t("shopping.redoNote")}</p>
      </div>

      <SectionLabel>{t("shopping.hiddenTitle")}</SectionLabel>
      {hidden.data.items.length > 0 ? (
        <ul>
          {hidden.data.items.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center gap-md border-b border-border-subtle">
              <span className="min-w-0 flex-1 truncate text-body-sm text-text-1" dir="auto">
                {hiddenLabel(item)}
              </span>
              <span className="text-card-desc text-text-3">{t(`shopping.scope_${item.scope}`)}</span>
              <button
                type="button"
                onClick={() => undo.mutate(item.id)}
                className="text-body-sm font-semibold text-primary hover:underline"
              >
                {t("shopping.undo")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-card-desc text-text-3">{t("shopping.hiddenNone")}</p>
      )}
      <p className="pt-sm text-card-desc text-text-3">{t("shopping.hiddenNote")}</p>

      <div className="mt-xl border-t border-border-subtle">
        <button
          type="button"
          disabled={reset.isPending}
          onClick={() => {
            setResetDone(false);
            setResetting(true);
          }}
          className="flex min-h-14 w-full items-center text-start text-body-sm font-semibold text-error hover:bg-pressed disabled:opacity-40"
        >
          {t("shopping.resetTitle")}
        </button>
      </div>

      <ConfirmDialog
        open={resetting}
        title={t("shopping.resetTitle")}
        body={t("shopping.resetBody")}
        confirmLabel={t("shopping.resetAction")}
        destructive
        busy={reset.isPending}
        onConfirm={() => reset.mutate()}
        onCancel={() => setResetting(false)}
      />

      <dialog
        ref={sizesDialog}
        aria-labelledby="sizes-title"
        className="m-auto max-h-[85dvh] w-[min(94vw,560px)] overflow-y-auto rounded-window border-0 bg-background p-xl text-text-1 backdrop:bg-backdrop"
      >
        <div className="flex items-start justify-between gap-md">
          <h2 id="sizes-title" className="text-heading font-bold">
            {t("shopping.sizes")}
          </h2>
          <button
            type="button"
            onClick={() => sizesDialog.current?.close()}
            className="inline-flex h-9 items-center rounded-control px-md text-body-sm font-semibold text-primary hover:bg-accent-tint"
          >
            {t("common.done")}
          </button>
        </div>
        <p className="mt-xs text-body-sm text-text-3">
          {t("shopping.max", { count: PERSONALISATION_SIZES_MAX })}
        </p>
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="mb-sm mt-lg text-section-label font-bold uppercase text-text-3">{group.name}</h3>
            <div className="flex flex-wrap gap-sm">
              {group.sizes.map((size) => (
                <Chip
                  key={size.id}
                  label={size.label}
                  selected={sizeIds.includes(size.id)}
                  onClick={() => toggle(size.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </dialog>
    </div>
  );
}
