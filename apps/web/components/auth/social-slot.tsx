"use client";

import { brand } from "@vinty/design/tokens";
import type { AuthProviders } from "@vinty/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { getAuthClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/login-links";
import { cn } from "@/lib/utils";

type Provider = "apple" | "google";

/** Apple's own logo shape (a single path, 24 by 24). Drawn in Apple's black, as their rules ask. */
function AppleMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden focusable="false" fill={brand.appleBlack}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** Google's own four colour "G". Its colours are fixed by Google's brand rules, so they are not our tokens. */
function GoogleMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill={brand.googleBlue}
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill={brand.googleGreen}
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill={brand.googleYellow}
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill={brand.googleRed}
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

const buttonClass =
  "inline-flex h-12 w-full items-center justify-center gap-sm rounded-control border bg-background px-lg text-body font-semibold text-text-1 hover:bg-surface disabled:opacity-50";

/**
 * "Continue with Apple" and "Continue with Google" under an "or" line (D-023). A button shows only when the server says
 * that provider is on for the website (`providers` comes from GET /v1/auth/providers, read by the page). The login
 * itself happens on the server's side (Better Auth's oauth proxy): the person goes to Apple or Google, comes back
 * here logged in, and a brand new person lands on the two welcome questions (D-022).
 */
export function SocialSlot({
  lang,
  next,
  providers,
}: {
  lang: string;
  next?: string;
  providers: AuthProviders | null;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apple = providers?.appleWeb === true;
  const google = providers?.google === true;
  if (!apple && !google) return null;

  async function start(provider: Provider) {
    if (busy) return;
    setBusy(provider);
    setError(null);
    const safe = safeNext(next);
    const origin = window.location.origin;
    const nextQuery = safe ? `&next=${encodeURIComponent(safe)}` : "";
    try {
      const { error: failed } = await getAuthClient().signIn.social({
        provider,
        callbackURL: `${origin}${safe ?? `/${lang}`}`,
        newUserCallbackURL: `${origin}/${lang}/welcome-questions${safe ? `?next=${encodeURIComponent(safe)}` : ""}`,
        // A refused login comes back here with ?error=..., and the page says why (log-in/page.tsx).
        errorCallbackURL: `${origin}/${lang}/log-in?social=${provider}${nextQuery}`,
      });
      // On success the browser is already on its way to Apple or Google.
      if (failed) throw new Error(failed.message);
    } catch {
      setError(
        t("errors.socialFailed", {
          provider: t(provider === "apple" ? "social.appleName" : "social.googleName"),
        }),
      );
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-md">
        <span className="h-px flex-1 bg-border" />
        <span className="text-body-sm text-text-3">{t("social.or")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {apple ? (
        <button
          type="button"
          onClick={() => start("apple")}
          disabled={busy !== null}
          aria-busy={busy === "apple"}
          className={cn(buttonClass)}
          style={{ borderColor: brand.appleBlack, color: brand.appleBlack }}
        >
          <AppleMark />
          {t("social.apple")}
        </button>
      ) : null}
      {google ? (
        <button
          type="button"
          onClick={() => start("google")}
          disabled={busy !== null}
          aria-busy={busy === "google"}
          className={cn(buttonClass, "border-border")}
        >
          <GoogleMark />
          {t("social.google")}
        </button>
      ) : null}
    </div>
  );
}
