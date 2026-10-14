"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";

/** A missing page or item: a friendly note and a way back to Home, in the page language. */
export default function NotFound() {
  const { t, i18n } = useTranslation();
  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <EmptyState
        heading
        title={t("web.notFound.title")}
        message={t("web.notFound.body")}
        action={
          <Link
            href={`/${i18n.language}`}
            className="mt-md inline-flex h-11 items-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
          >
            {t("web.notFound.home")}
          </Link>
        }
      />
    </main>
  );
}
