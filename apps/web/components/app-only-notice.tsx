"use client";

import { type ReactElement, useCallback, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * The small notice for things that only work in the app until the website gets them (buy, make your price, message,
 * report). `const [show, notice] = useAppOnlyNotice()`: render `notice` once and call `show()` from a button.
 * It is the browser's own modal dialog, so focus stays inside and Escape closes it.
 */
export function useAppOnlyNotice(): [show: () => void, notice: ReactElement] {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const show = useCallback(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  const close = () => dialog.current?.close();
  const notice = (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the dim area, Escape already closes the dialog natively
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      className="m-auto w-[min(92vw,400px)] rounded-window border-0 bg-background p-xl text-text-1 shadow-none backdrop:bg-backdrop"
    >
      <h2 id={`${id}-title`} className="text-heading font-bold">
        {t("web.item.appOnly.title")}
      </h2>
      <p id={`${id}-body`} className="mt-sm text-body-sm text-text-3">
        {t("web.item.appOnly.body")}
      </p>
      <button
        type="button"
        onClick={close}
        className="mt-xl inline-flex h-11 w-full items-center justify-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
      >
        {t("common.close")}
      </button>
    </dialog>
  );
  return [show, notice];
}
