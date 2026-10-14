"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { LANG_COOKIE, LANGUAGES, type Lang, switchPath } from "@/lib/i18n";
import { useUpdateSettings } from "@/lib/settings-hooks";
import { cn } from "@/lib/utils";

/**
 * Settings, Language. Choosing a language saves it on the account, remembers it for this browser (the `lang` cookie) and
 * moves to the same page in the other language's address, which flips the direction at once.
 */
export function LanguagePicker({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useUpdateSettings();
  const [failed, setFailed] = useState(false);

  const choose = (language: Lang) => {
    if (language === lang) return;
    setFailed(false);
    update.mutate(
      { language },
      {
        onSuccess: () => {
          // biome-ignore lint/suspicious/noDocumentCookie: a plain one-line cookie, the Cookie Store API is not in every browser yet
          document.cookie = `${LANG_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`;
          router.push(switchPath(window.location.pathname, language));
        },
        onError: () => setFailed(true),
      },
    );
  };

  return (
    <div>
      {failed ? <Notice kind="error">{t("errors.general")}</Notice> : null}
      <div role="radiogroup" aria-label={t("settings.language")} className="flex flex-col">
        {LANGUAGES.map((language) => {
          const selected = language === lang;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a row-sized radio button is clearer for touch than a small native radio
            <button
              key={language}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={update.isPending}
              onClick={() => choose(language)}
              lang={language}
              className={cn(
                "flex min-h-14 items-center gap-md border-b border-border-subtle text-start text-body font-medium hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:opacity-60",
                language === "he" ? "font-heebo-500" : "font-aileron-500",
              )}
            >
              <span className="flex-1">{t(`languages.${language}`)}</span>
              {selected ? <Check size={20} aria-hidden className="text-primary" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
