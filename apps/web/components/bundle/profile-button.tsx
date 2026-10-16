"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { bundleLadderQuery } from "@/lib/bundle-queries";

/** The Bundle button on a seller's page. Hidden while the seller's bundles are off. */
export function BundleProfileButton({ lang, sellerId }: { lang: string; sellerId: string }) {
  const { t } = useTranslation();
  const ladder = useQuery(bundleLadderQuery(sellerId));
  if (!ladder.data?.on || ladder.data.tiers.length === 0) return null;
  return (
    <Link
      href={`/${lang}/bundle/${sellerId}`}
      className="inline-flex h-11 items-center justify-center gap-sm rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
    >
      <Layers size={18} aria-hidden />
      {t("bundle.shop")}
    </Link>
  );
}
