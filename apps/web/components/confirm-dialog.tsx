"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * A "Are you sure?" box (the website's version of the app's alert): the browser's own modal dialog, so focus stays
 * inside, Escape cancels and the page behind cannot be reached. `open` is controlled by the caller.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
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
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,400px)] rounded-window border-0 bg-background p-xl text-text-1 backdrop:bg-backdrop"
    >
      <h2 id="confirm-title" className="text-heading font-bold">
        {title}
      </h2>
      {body ? <p className="mt-sm text-body-sm text-text-3">{body}</p> : null}
      {children}
      <div className="mt-xl flex flex-col gap-sm">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            "inline-flex h-12 items-center justify-center rounded-control px-lg text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-60",
            destructive ? "bg-error" : "bg-primary",
          )}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-12 items-center justify-center rounded-control px-lg text-body font-semibold text-text-2 hover:bg-pressed"
        >
          {t("common.cancel")}
        </button>
      </div>
    </dialog>
  );
}
