"use client";

import { formatPrice, ORDER_STATUS_VARIANT, type OrderStatus, orderStatusKey } from "@vinty/shared";
import {
  AlertTriangle,
  Check,
  Clock,
  type LucideIcon,
  PackageCheck,
  Truck,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";

const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  pending_payment: Clock,
  paid: Wallet,
  shipped: Truck,
  delivered: PackageCheck,
  completed: Check,
  cancelled: XCircle,
  disputed: AlertTriangle,
  refunded: Undo2,
};

/** The status of an order in plain words, with its icon (never colour alone). Same words as the app. */
export function OrderStatusBadge({ status, role }: { status: OrderStatus; role: "buyer" | "seller" }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant={ORDER_STATUS_VARIANT[status]}
      icon={STATUS_ICON[status]}
      label={t(orderStatusKey(status, role))}
    />
  );
}

type AddressShape = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  phone?: string | null;
};

/** An address written out on lines: name, street, city and postcode, phone. */
export function AddressLines({ address }: { address: AddressShape }) {
  return (
    <div className="flex flex-col gap-px text-start">
      <span className="text-body font-semibold text-text-1">{address.fullName}</span>
      <span className="text-body-sm text-text-2">
        {[address.line1, address.line2].filter(Boolean).join(", ")}
      </span>
      <span className="text-body-sm text-text-2">
        {address.postcode} {address.city}
      </span>
      {address.phone ? <span className="text-body-sm text-text-2">{address.phone}</span> : null}
    </div>
  );
}

/** A small photo square for an item line. */
export function ItemThumb({ url, size = 64 }: { url: string | null; size?: number }) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-control bg-pressed"
      style={{ width: size, height: size }}
    >
      {url ? (
        // biome-ignore lint/performance/noImgElement: a photo straight from storage
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "mt-xs flex items-center justify-between gap-md border-t border-border-subtle py-xs"
          : "flex items-center justify-between gap-md py-xs"
      }
    >
      <dt className={strong ? "text-body font-bold text-text-1" : "text-body-sm text-text-2"}>{label}</dt>
      <dd
        dir="ltr"
        className={strong ? "text-heading font-bold text-text-1" : "text-body-sm font-medium text-text-1"}
      >
        {value}
      </dd>
    </div>
  );
}

/** The numbers shown: a checkout quote or an existing order. All from the server, nothing worked out here. */
export type Totals = {
  currency: string;
  itemsCount: number;
  itemsSubtotalMinor: number;
  bundleDiscountMinor: number;
  bundleDiscountPercent?: number;
  buyerProtectionFeeMinor: number;
  shippingMinor: number;
  totalMinor: number;
  /** What a bundle saves in all (discount plus postage). Shown as one green line when above 0. */
  bundleSavedMinor?: number;
};

/** The numbers of an order: items, bundle discount, Buyer Protection, postage and the total. */
export function PriceBreakdown({ totals, label }: { totals: Totals; label: string }) {
  const { t } = useTranslation();
  const money = (v: number) => formatPrice(v, totals.currency);
  return (
    <div className="flex flex-col gap-sm">
      <dl aria-label={label} className="rounded-control border border-border-subtle p-md">
        <Line
          label={t("checkout.items", { count: totals.itemsCount })}
          value={money(totals.itemsSubtotalMinor)}
        />
        {totals.bundleDiscountMinor > 0 ? (
          <Line
            label={t("checkout.bundleDiscount", {
              percent:
                totals.bundleDiscountPercent ??
                Math.round((totals.bundleDiscountMinor / Math.max(totals.itemsSubtotalMinor, 1)) * 100),
            })}
            value={`-${money(totals.bundleDiscountMinor)}`}
          />
        ) : null}
        <Line label={t("checkout.protection")} value={money(totals.buyerProtectionFeeMinor)} />
        <Line label={t("checkout.postage")} value={money(totals.shippingMinor)} />
        <Line strong label={t("checkout.total")} value={money(totals.totalMinor)} />
      </dl>
      {totals.bundleSavedMinor && totals.bundleSavedMinor > 0 ? (
        <p
          role="status"
          className="rounded-control bg-success-tint px-md py-sm text-body-sm font-semibold text-success"
        >
          {t("bundle.saveLine", { amount: money(totals.bundleSavedMinor) })}
        </p>
      ) : null}
    </div>
  );
}
