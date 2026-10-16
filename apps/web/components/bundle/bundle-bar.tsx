"use client";

import { bundleSavedMinor, formatPrice } from "@vinty/shared";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useViewer } from "@/components/site-context";
import { liveBundleItems, useSellerBundle } from "@/lib/bundle-queries";

/**
 * The slim bar at the bottom while the viewer has a bundle with this seller (D-049, decision 3: only on that seller's
 * item pages and profile). It sits above the phone Buy bar (which publishes its height as --buy-bar-h) and leaves
 * room at the end of the page so it never covers a button.
 */
export function BundleBar({ lang, sellerId }: { lang: string; sellerId: string }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ladder, bundle } = useSellerBundle(sellerId);
  if (!viewer || !bundle || !ladder?.on) return null;
  const items = liveBundleItems(bundle);
  if (items.length === 0) return null;

  const count = items.length;
  const saved = bundleSavedMinor(bundle);
  const summary = t(bundle.discountPercent > 0 ? "bundle.barCountOff" : "bundle.barCount", {
    count,
    percent: bundle.discountPercent,
  });
  const photos = items.filter((i) => i.photoUrl).slice(0, 3);

  return (
    <>
      <div aria-hidden className="h-[72px]" />
      <div
        style={{ bottom: "var(--buy-bar-h, 0px)" }}
        className="fixed inset-x-0 z-30 border-t border-primary bg-primary px-lg py-sm text-on-accent"
      >
        <div className="mx-auto flex max-w-[1280px] items-center gap-md">
          {/* On a phone the photos give their room to the text, so "You save" is never cut off. */}
          <div aria-hidden className="hidden shrink-0 items-center sm:flex">
            {photos.map((p, i) => (
              // biome-ignore lint/performance/noImgElement: a small cover that comes ready sized
              <img
                key={p.listingId}
                src={p.photoUrl ?? ""}
                alt=""
                className={`h-9 w-9 rounded-full border-2 border-primary object-cover ${i > 0 ? "-ms-3" : ""}`}
              />
            ))}
          </div>
          <div role="status" className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-semibold">
              {saved > 0
                ? `${summary} · ${t("bundle.barSave", { amount: formatPrice(saved, bundle.currency) })}`
                : summary}
            </p>
            {bundle.nextTier ? (
              <p className="truncate text-card-meta opacity-80">
                {t("bundle.barNext", {
                  count: bundle.nextTier.addItems,
                  percent: bundle.nextTier.percentOff,
                })}
              </p>
            ) : null}
          </div>
          <Link
            href={`/${lang}/bundle/${sellerId}`}
            className="inline-flex h-10 shrink-0 items-center rounded-control bg-background px-lg text-body-sm font-semibold text-primary hover:opacity-90"
          >
            {t("bundle.view")}
          </Link>
        </div>
      </div>
    </>
  );
}
