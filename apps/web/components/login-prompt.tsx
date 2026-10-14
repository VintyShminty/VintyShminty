"use client";

import Link from "next/link";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loginHref, signUpHref } from "@/lib/login-links";

type Prompt = { ask: () => void };
const PromptContext = createContext<Prompt>({ ask: () => {} });

/**
 * Asks a logged out visitor to log in (heart, message, buy, make your price, follow, sell). Call `ask()` from any
 * client component under the provider: `const { ask } = useLoginPrompt()`. The dialog is the browser's own modal
 * dialog, so focus stays inside it, Escape closes it and the page behind is not reachable. The buttons carry the
 * current page as `next`, so the visitor lands back here after logging in.
 */
export function useLoginPrompt(): Prompt {
  return useContext(PromptContext);
}

export function LoginPromptProvider({ lang, children }: { lang: string; children: ReactNode }) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [next, setNext] = useState("/");

  const ask = useCallback(() => {
    setNext(`${window.location.pathname}${window.location.search}`);
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  const close = useCallback(() => dialog.current?.close(), []);

  // Going to another page closes the dialog (it lives in the layout, so it would otherwise stay open).
  useEffect(() => {
    const el = dialog.current;
    return () => el?.close();
  }, []);

  return (
    <PromptContext.Provider value={{ ask }}>
      {children}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the dim area, Escape already closes the dialog natively */}
      <dialog
        ref={dialog}
        aria-labelledby="login-prompt-title"
        aria-describedby="login-prompt-body"
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto w-[min(92vw,400px)] rounded-window border-0 bg-background p-xl text-text-1 shadow-none backdrop:bg-backdrop"
      >
        <h2 id="login-prompt-title" className="text-heading font-bold">
          {t("web.loginPrompt.title")}
        </h2>
        <p id="login-prompt-body" className="mt-sm text-body-sm text-text-3">
          {t("web.loginPrompt.body")}
        </p>
        <div className="mt-xl flex flex-col gap-sm">
          <Link
            href={loginHref(lang, next)}
            onClick={close}
            className="inline-flex h-11 items-center justify-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
          >
            {t("welcome.logIn")}
          </Link>
          <Link
            href={signUpHref(lang, next)}
            onClick={close}
            className="inline-flex h-11 items-center justify-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
          >
            {t("welcome.signUp")}
          </Link>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 items-center justify-center rounded-control px-lg text-body-sm text-text-3 hover:bg-pressed"
          >
            {t("common.close")}
          </button>
        </div>
      </dialog>
    </PromptContext.Provider>
  );
}
