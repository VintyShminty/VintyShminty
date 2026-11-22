"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";

/** A page whose server request failed: a friendly note, a Try again button and a way back to Home, in the page language. */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <EmptyState
        heading
        title={t("web.error.title")}
        message={t("web.error.body")}
        action={
          <div className="mt-md flex flex-wrap items-center justify-center gap-md">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 items-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
            >
              {t("common.tryAgain")}
            </button>
            <Link
              href={`/${i18n.language}`}
              className="inline-flex h-11 items-center rounded-control px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
            >
              {t("web.error.home")}
            </Link>
          </div>
        }
      />
    </main>
  );
}
