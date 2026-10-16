"use client";

import { type BundleTier, bundleDiscountPercentFor } from "@vinty/shared";
import { Check, Layers } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { liveBundleItems, useSellerBundle } from "@/lib/bundle-queries";
import { cn } from "@/lib/utils";

/** The seller's steps as small tiles. A step is lit once the bundle has that many items. */
export function BundleSteps({ tiers, count }: { tiers: readonly BundleTier[]; count: number }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t("bundle.stepsLabel")} className="flex gap-sm">
      {tiers.map((tier) => {
        const lit = count >= tier.minItems;
        return (
          <li
            key={tier.minItems}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-px rounded-control border px-sm py-sm text-center",
              lit ? "border-primary bg-primary text-on-accent" : "border-border-subtle text-text-2",
            )}
          >
            <span className="text-card-meta">{t("bundle.stepItems", { count: tier.minItems })}</span>
            <span className="text-body-sm font-bold">
              {t("bundle.stepOff", { percent: tier.percentOff })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const primaryButton =
  "inline-flex h-11 w-full items-center justify-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-60";
const outlineButton =
  "inline-flex h-11 w-full items-center justify-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint disabled:opacity-60";

/**
 * The Bundle box on the item page, under the seller's card (D-049). Shown for an item on sale that is not yours, and
 * only when the seller's bundles are on. Three states: no bundle yet, a bundle that does not hold this item yet, and
 * this item is in. Visitors who are not logged in see the first state and Add to bundle asks them to log in.
 */
export function BundleBox({
  lang,
  sellerId,
  sellerName,
  listingId,
}: {
  lang: string;
  sellerId: string;
  sellerName: string;
  listingId: string;
}) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const { ladder, bundle, bundleLoading, busy, failed, inBundle, add, remove } = useSellerBundle(sellerId);

  if (!ladder?.on || ladder.tiers.length === 0) return null;
  const items = liveBundleItems(bundle);
  const count = items.length;
  const hasThis = inBundle(listingId);
  const percent = bundle?.discountPercent ?? 0;
  const viewHref = `/${lang}/bundle/${sellerId}`;
  const onAdd = () => (viewer ? add(listingId) : ask());

  let heading = t("bundle.boxTitle", { name: sellerName });
  let line: string | null = null;
  let steps = 0;
  if (viewer && bundle && count > 0) {
    steps = count;
    if (hasThis) {
      heading = t("bundle.yourBundle");
      line = t(percent > 0 ? "bundle.isInOff" : "bundle.isIn", { count, percent });
    } else {
      line = t(percent > 0 ? "bundle.notInYetOff" : "bundle.notInYet", { count, percent });
    }
  }
  const after = bundleDiscountPercentFor(ladder.tiers, count + 1);
  const addLabel =
    count > 0 && after > percent ? t("bundle.addGain", { percent: after }) : t("bundle.addPlain");

  return (
    <section
      aria-label={heading}
      aria-busy={bundleLoading}
      className="flex flex-col gap-md rounded-control border border-border-subtle p-md"
    >
      <div className="flex items-center gap-sm">
        {hasThis ? (
          <Check size={18} aria-hidden className="shrink-0 text-primary" />
        ) : (
          <Layers size={18} aria-hidden className="shrink-0 text-primary" />
        )}
        <h2 className="min-w-0 flex-1 truncate text-body font-semibold text-text-1">{heading}</h2>
      </div>
      <BundleSteps tiers={ladder.tiers} count={steps} />
      {line ? (
        <p role="status" className="text-body-sm text-text-1">
          {line}
        </p>
      ) : (
        <p className="text-body-sm text-text-3">{t("bundle.postageOnce")}</p>
      )}
      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t("bundle.changeFailed")}
        </p>
      ) : null}
      {hasThis ? (
        <div className="flex gap-sm">
          <Link href={viewHref} className={primaryButton}>
            {t("bundle.view")}
          </Link>
          <button type="button" onClick={() => remove(listingId)} disabled={busy} className={outlineButton}>
            {t("bundle.remove")}
          </button>
        </div>
      ) : count > 0 ? (
        <div className="flex flex-col gap-sm">
          <button type="button" onClick={onAdd} disabled={busy} className={primaryButton}>
            {addLabel}
          </button>
          <Link href={viewHref} className={outlineButton}>
            {t("bundle.view")}
          </Link>
        </div>
      ) : (
        <button type="button" onClick={onAdd} disabled={busy} className={primaryButton}>
          {t("bundle.add")}
        </button>
      )}
    </section>
  );
}
