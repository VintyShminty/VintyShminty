"use client";

import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { useSellerBundle } from "@/lib/bundle-queries";
import { cn } from "@/lib/utils";

/**
 * The small "+ Bundle" pill at the bottom end of a seller's other items (D-049). It becomes "In bundle" with a tick once
 * the item is in, and a tap on it takes the item out again. Shown only while the seller's bundles are on.
 */
export function BundleCardButton({
  listingId,
  sellerId,
  title,
}: {
  listingId: string;
  sellerId: string;
  title: string;
}) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const { ladder, busy, inBundle, add, remove } = useSellerBundle(sellerId);
  if (!ladder?.on || ladder.tiers.length === 0) return null;
  const inside = viewer !== null && inBundle(listingId);
  return (
    <button
      type="button"
      aria-pressed={inside}
      aria-label={t(inside ? "web.bundle.remove" : "web.bundle.add", { title })}
      disabled={busy}
      onClick={() => {
        if (!viewer) return ask();
        if (inside) remove(listingId);
        else add(listingId);
      }}
      className={cn(
        "pointer-events-auto absolute bottom-sm end-sm z-10 inline-flex h-7 items-center gap-xs rounded-full px-sm text-card-meta font-semibold disabled:opacity-60",
        inside ? "bg-primary text-on-accent" : "bg-background text-primary hover:bg-pressed",
      )}
    >
      {inside ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
      {inside ? t("bundle.cardIn") : t("bundle.cardAdd")}
    </button>
  );
}
