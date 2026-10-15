"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { cn } from "@/lib/utils";

/** The Sell button. Logged out it opens the login prompt, logged in it goes to `/[lang]/sell` (built in step W6). */
export function SellButton({ lang, className }: { lang: string; className?: string }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const classes = cn(
    "inline-flex h-[34px] items-center justify-center gap-xs rounded-full bg-primary px-[16px] text-body-sm font-semibold text-on-accent hover:opacity-90",
    className,
  );
  const content = (
    <>
      <Plus size={15} strokeWidth={2} aria-hidden />
      {t("tabs.sell")}
    </>
  );
  return viewer ? (
    <Link href={`/${lang}/sell`} className={classes}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={ask} className={classes}>
      {content}
    </button>
  );
}
