"use client";

import { Check, Shirt, Smartphone, Sun, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TIPS = [
  { key: "upright", icon: Smartphone },
  { key: "wholeItem", icon: Shirt },
  { key: "light", icon: Sun },
] as const;

/** One drawn example: a frame with a shirt in it and a Like this or Not like this label under it. */
function Example({ good }: { good: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-sm">
      <div
        aria-hidden
        className={cn(
          "flex overflow-hidden rounded-control border-[1.5px] border-text-3 bg-surface",
          good
            ? "h-[136px] w-[88px] items-center justify-center"
            : "h-[88px] w-[136px] items-end justify-end",
        )}
      >
        {good ? (
          <Shirt size={56} className="text-text-3" />
        ) : (
          // Too big and pushed past the corner, so part of it is cut off, like a photo taken sideways and too close.
          <Shirt size={92} className="-mb-[30px] -me-[34px] shrink-0 text-text-3" />
        )}
      </div>
      <span
        className={cn(
          "flex items-center gap-xs text-body-sm font-semibold",
          good ? "text-success" : "text-error",
        )}
      >
        {good ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
        {t(good ? "sell.photos.guide.good" : "sell.photos.guide.bad")}
      </span>
    </div>
  );
}

/**
 * The photo example a first time seller sees after clicking Add your photos (D-066): a drawn right and wrong photo,
 * the three tips and Got it. Got it opens the file picker, the cross or Escape closes it without adding photos.
 */
export function PhotoGuide({
  open,
  onDone,
  onClose,
}: {
  open: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="photo-guide-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,420px)] rounded-window border-0 bg-background p-xl backdrop:bg-backdrop"
    >
      <div className="flex flex-col">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("sell.photos.guide.close")}
          className="-ms-sm self-start rounded-control p-sm text-text-1 hover:bg-pressed"
        >
          <X size={22} aria-hidden />
        </button>
        <h2 id="photo-guide-title" className="mt-sm text-title text-text-1">
          {t("sell.photos.guide.title")}
        </h2>
        <p className="mt-xs text-body text-text-3">{t("sell.photos.guide.subtitle")}</p>
        <div className="mt-xl flex items-end justify-center gap-xl">
          <Example good />
          <Example good={false} />
        </div>
        <ul className="mt-xl flex flex-col gap-md">
          {TIPS.map((tip) => (
            <li key={tip.key} className="flex items-center gap-md text-body text-text-1">
              <tip.icon size={20} aria-hidden className="shrink-0 text-text-3" />
              {t(`sell.photos.firstTips.${tip.key}`)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onDone}
          className="mt-xl inline-flex h-11 items-center justify-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
        >
          {t("sell.photos.guide.gotIt")}
        </button>
      </div>
    </dialog>
  );
}
