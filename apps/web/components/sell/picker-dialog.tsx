"use client";

import { ArrowLeft, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The box every sell form picker opens in (D-010 on the web): the browser's own modal dialog, so focus stays inside,
 * Escape closes it and the page behind cannot be reached. A bottom sheet on a phone, a centred panel on a laptop.
 * `large` is for the category tree. A back button shows when `onBack` is given (one level up in the tree).
 */
export function PickerDialog({
  open,
  title,
  onClose,
  onBack,
  large = false,
  action,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onBack?: () => void;
  large?: boolean;
  /** A quiet text button in the header, for example Clear. */
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the dimmed backdrop, Escape already closes through onCancel
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the dimmed backdrop (the dialog element itself) closes it.
        if (e.target === dialog.current) onClose();
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full max-w-none flex-col overflow-hidden rounded-b-none rounded-t-window border-0 bg-background p-0 text-text-1 backdrop:bg-backdrop open:flex",
        "md:inset-auto md:m-auto md:rounded-b-window",
        large ? "md:h-[min(80dvh,720px)] md:w-[min(92vw,640px)]" : "md:max-h-[80dvh] md:w-[min(92vw,480px)]",
      )}
    >
      {open ? (
        <>
          <header className="flex h-14 shrink-0 items-center gap-sm border-b border-border-subtle px-md">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label={t("common.back")}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-pressed"
              >
                <ArrowLeft size={20} aria-hidden className="rtl:rotate-180" />
              </button>
            ) : null}
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-heading font-bold text-text-1">
              {title}
            </h2>
            {action ? (
              <button
                type="button"
                onClick={action.onClick}
                className="px-sm text-body-sm font-bold text-primary hover:underline"
              >
                {action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-pressed"
            >
              <X size={20} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}

/** A tick-in-a-circle row used by the single choice lists. */
export function RadioRow({
  label,
  detail,
  on,
  onClick,
  leading,
}: {
  label: string;
  detail?: string;
  on: boolean;
  onClick: () => void;
  leading?: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a styled choice row, the radio role is the right pattern
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-md border-b border-border-subtle px-lg py-sm text-start hover:bg-surface"
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body text-text-1">{label}</span>
        {detail ? <span className="text-card-desc text-text-3">{detail}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px]",
          on ? "border-primary" : "border-text-4",
        )}
      >
        {on ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </span>
    </button>
  );
}
