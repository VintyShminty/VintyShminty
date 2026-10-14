"use client";

import { useQuery } from "@tanstack/react-query";
import { type DeliveryMethod, formatPrice } from "@vinty/shared";
import { Home, Info, Loader2, MapPin, PackageOpen, Plus, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { AddressForm } from "@/components/checkout/address-form";
import { AddressLines, ItemThumb, PriceBreakdown } from "@/components/orders/order-parts";
import { ApiClientError } from "@/lib/api-error";
import {
  addressesQuery,
  type CheckoutTarget,
  checkoutQuoteQuery,
  newIdempotencyKey,
  orderQuery,
  usePayOrder,
  usePlaceOrder,
} from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";

type Problem = "unavailable" | "offerClosed" | "own" | "blocked" | "generic";

/** Why the checkout cannot continue, from the server's answer. */
function problemOf(err: unknown): Problem {
  if (err instanceof ApiClientError) {
    if (err.code === "listing_unavailable" || err.status === 404) return "unavailable";
    if (err.code === "invalid_transition") return "offerClosed";
    if (err.code === "blocked") return "blocked";
    if (err.code === "forbidden") return "own";
  }
  return "generic";
}

const shell = "mx-auto w-full max-w-[1000px] px-lg pb-2xl pt-xl md:px-xl";
const primaryButton =
  "inline-flex h-12 w-full items-center justify-center gap-sm rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-60";

function ProblemView({ problem, lang, onRetry }: { problem: Problem; lang: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <main className={shell}>
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-md py-2xl text-center">
        <PackageOpen size={48} className="text-text-3" aria-hidden />
        <h1 className="text-heading font-bold text-text-1">{t(`checkout.problem.${problem}Title`)}</h1>
        <p className="text-body text-text-2">{t(`checkout.problem.${problem}Note`)}</p>
        {problem === "generic" ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
          >
            {t("common.tryAgain")}
          </button>
        ) : null}
        <Link
          href={`/${lang}`}
          className="inline-flex h-11 items-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
        >
          {t("checkout.problem.close")}
        </Link>
      </div>
    </main>
  );
}

function Loading() {
  const { t } = useTranslation();
  return (
    <main className={shell}>
      <div className="flex justify-center py-2xl" role="status" aria-label={t("web.inbox.loading")}>
        <Loader2 size={28} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
      </div>
    </main>
  );
}

function ItemRow({
  item,
  currency,
}: {
  item: {
    listingId: string | null;
    title: string;
    brand: string | null;
    size: string | null;
    photoUrl: string | null;
    priceMinor: number;
  };
  currency: string;
}) {
  return (
    <div className="flex items-center gap-md">
      <ItemThumb url={item.photoUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="line-clamp-2 text-body font-semibold text-text-1">{item.title}</span>
        {item.brand || item.size ? (
          <span className="truncate text-card-meta text-text-3">
            {[item.brand, item.size].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </div>
      <span className="text-body font-bold text-text-1">{formatPrice(item.priceMinor, currency)}</span>
    </div>
  );
}

function MethodCard({
  selected,
  icon: Icon,
  title,
  note,
  price,
  onClick,
}: {
  selected: boolean;
  icon: typeof Home;
  title: string;
  note: string;
  price: string;
  onClick: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card that acts as one choice of a radio group, with the dot drawn by us
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${title}, ${price}`}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-md rounded-control border p-md text-start",
        selected ? "border-primary bg-accent-tint" : "border-border bg-background hover:bg-surface",
      )}
    >
      <Icon size={22} className="shrink-0 text-text-2" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-body font-semibold text-text-1">{title}</span>
        <span className="text-card-desc text-text-3">{note}</span>
      </span>
      <span className="text-body-sm font-semibold text-text-1">{price}</span>
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-text-4",
        )}
      >
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </span>
    </button>
  );
}

function SimulatedNote() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-sm rounded-control border border-border bg-accent-tint p-md">
      <Info size={18} className="mt-px shrink-0 text-primary" aria-hidden />
      <div className="flex flex-col gap-xs">
        <p className="text-body-sm font-semibold text-primary">{t("checkout.simulatedTitle")}</p>
        <p className="text-body-sm text-text-2">{t("checkout.simulatedNote")}</p>
      </div>
    </div>
  );
}

/** Pay an order that already exists (the order page's Pay button). Shows its summary and pays it, once. */
function PayExisting({ orderId, lang }: { orderId: string; lang: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const order = useQuery(orderQuery(orderId));
  const pay = usePayOrder();
  const inFlight = useRef(false);
  const key = useRef(newIdempotencyKey());
  const [banner, setBanner] = useState<string | null>(null);
  const o = order.data;

  // Paid already (maybe in another tab) or closed: nothing to pay here, show the order.
  const payable = o?.status === "pending_payment" && o.actions.includes("pay");
  useEffect(() => {
    if (o && !payable) router.replace(`/${lang}/orders/${o.id}`);
  }, [o, payable, router, lang]);

  if (!o) {
    return order.isError ? (
      <ProblemView
        problem={
          order.error instanceof ApiClientError && order.error.status === 404 ? "unavailable" : "generic"
        }
        lang={lang}
        onRetry={() => void order.refetch()}
      />
    ) : (
      <Loading />
    );
  }
  if (!payable) return <Loading />;

  const submit = async () => {
    if (inFlight.current || pay.isPending) return;
    inFlight.current = true;
    setBanner(null);
    try {
      const paid = await pay.mutateAsync({ orderId, key: key.current });
      router.replace(`/${lang}/orders/${paid.id}?placed=1`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "invalid_transition")
        setBanner(t("checkout.timedOut"));
      else if (err instanceof ApiClientError && err.code === "network") setBanner(t("errors.network"));
      else setBanner(t("errors.general"));
    } finally {
      inFlight.current = false;
    }
  };

  const home = o.deliveryMethod === "home";
  return (
    <main className={shell}>
      <h1 className="mb-xl text-title font-bold text-text-1">{t("checkout.title")}</h1>
      <div className="grid gap-2xl md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-xl">
          <div className="flex flex-col gap-md">
            {o.items.map((item) => (
              <ItemRow key={item.listingId ?? item.title} item={item} currency={o.currency} />
            ))}
          </div>
          <section className="flex flex-col gap-sm">
            <h2 className="text-section-label font-bold uppercase text-text-3">{t("checkout.delivery")}</h2>
            <div className="flex items-center gap-md rounded-control border border-border p-md">
              {home ? (
                <Home size={22} className="text-text-2" aria-hidden />
              ) : (
                <MapPin size={22} className="text-text-2" aria-hidden />
              )}
              <div className="flex flex-col gap-px">
                <span className="text-body font-semibold text-text-1">
                  {home ? t("checkout.home") : t("checkout.pickup")}
                </span>
                <span className="text-card-desc text-text-3">
                  {home ? t("checkout.homeNote") : t("checkout.pickupNote")}
                </span>
              </div>
            </div>
            {home && o.shippingAddress ? (
              <div className="rounded-control border border-border p-md">
                <AddressLines address={o.shippingAddress} />
              </div>
            ) : null}
          </section>
        </div>
        <aside className="flex flex-col gap-lg md:sticky md:top-28 md:self-start">
          <h2 className="text-section-label font-bold uppercase text-text-3">{t("checkout.summary")}</h2>
          <PriceBreakdown
            label={t("checkout.summary")}
            totals={{ ...o, itemsCount: o.items.length, bundleDiscountPercent: undefined }}
          />
          {o.payByAt ? (
            <p className="flex items-center gap-xs text-card-desc font-semibold text-warning">
              <Timer size={14} aria-hidden />
              {t("orders.payBy", {
                time: new Date(o.payByAt).toLocaleTimeString(i18n.language, {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </p>
          ) : null}
          <SimulatedNote />
          {banner ? <Notice kind="error">{banner}</Notice> : null}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pay.isPending}
            className={primaryButton}
          >
            {t("checkout.pay", { amount: formatPrice(o.totalMinor, o.currency) })}
          </button>
        </aside>
      </div>
    </main>
  );
}

/**
 * Checkout (the app's checkout on a laptop): what you are buying, how it gets to you, where to, the honest price
 * breakdown and Pay. Reached from Buy on the item page, an accepted offer in the chat, or a bundle. Paying is
 * pretend in this version and the page says so.
 */
export function CheckoutView({
  lang,
  listingId,
  offerId,
  bundleId,
  orderId,
}: {
  lang: string;
  listingId?: string;
  offerId?: string;
  bundleId?: string;
  orderId?: string;
}) {
  if (orderId) return <PayExisting orderId={orderId} lang={lang} />;
  const target: CheckoutTarget | null = offerId
    ? { offerId }
    : bundleId
      ? { bundleId }
      : listingId
        ? { listingId }
        : null;
  return <NewCheckout lang={lang} target={target} />;
}

function NewCheckout({ lang, target }: { lang: string; target: CheckoutTarget | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [method, setMethod] = useState<DeliveryMethod>("pickup_point");
  const [pickedAddress, setPickedAddress] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [soldOut, setSoldOut] = useState(false);
  const place = usePlaceOrder();
  const inFlight = useRef(false);
  // One key per checkout page. It changes with what is being ordered, so a changed address never gets an old order.
  const base = useRef(newIdempotencyKey());

  const quote = useQuery({
    ...checkoutQuoteQuery(target ?? { listingId: "none" }, method),
    enabled: target !== null,
  });
  const addresses = useQuery(addressesQuery());
  const list = addresses.data ?? [];
  const address =
    list.find((a) => a.id === pickedAddress) ?? list.find((a) => a.isDefault) ?? list[0] ?? null;
  const needsAddress = method === "home" && !address;
  // Home delivery with no saved address opens the form straight away.
  const showForm = method === "home" && addresses.isSuccess && (adding || list.length === 0);

  if (!target) return <ProblemView problem="unavailable" lang={lang} onRetry={() => {}} />;
  const problem = soldOut ? "unavailable" : quote.isError && !quote.data ? problemOf(quote.error) : null;
  if (problem) {
    return (
      <ProblemView
        problem={problem}
        lang={lang}
        onRetry={() => {
          setSoldOut(false);
          void quote.refetch();
        }}
      />
    );
  }
  const q = quote.data;
  if (!q) return <Loading />;

  const pay = async () => {
    // A second click while the first is working must never make a second order.
    if (inFlight.current || place.isPending || needsAddress) return;
    inFlight.current = true;
    setBanner(null);
    try {
      // Ask for the numbers once more: if they moved, say so instead of charging something new.
      const fresh = await quote.refetch();
      if (fresh.isError) {
        if (problemOf(fresh.error) === "generic") setBanner(t("errors.general"));
        else setSoldOut(true);
        return;
      }
      if (fresh.data && fresh.data.totalMinor !== q.totalMinor) {
        setBanner(
          t("checkout.priceChanged", { total: formatPrice(fresh.data.totalMinor, fresh.data.currency) }),
        );
        return;
      }
      const order = await place.mutateAsync({
        target,
        deliveryMethod: method,
        addressId: method === "home" ? (address?.id ?? null) : null,
        key: `${base.current}-${method}-${method === "home" ? (address?.id ?? "x") : "x"}`,
      });
      router.replace(`/${lang}/orders/${order.id}?placed=1`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "listing_unavailable") setSoldOut(true);
      else if (err instanceof ApiClientError && err.code === "invalid_transition") {
        // The 30 minute hold ran out: the next try starts a fresh checkout.
        base.current = newIdempotencyKey();
        setBanner(t("checkout.timedOut"));
      } else if (err instanceof ApiClientError && err.code === "network") setBanner(t("errors.network"));
      else setBanner(t("errors.general"));
    } finally {
      inFlight.current = false;
    }
  };

  const optionPrice = (m: DeliveryMethod) => {
    const option = q.deliveryOptions.find((o) => o.method === m);
    return formatPrice(option?.priceMinor ?? q.shippingMinor, q.currency);
  };

  return (
    <main className={shell}>
      <h1 className="mb-xl text-title font-bold text-text-1">{t("checkout.title")}</h1>
      <div className="grid gap-2xl md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-xl">
          <div className="flex flex-col gap-md">
            {q.items.map((item) => (
              <ItemRow key={item.listingId ?? item.title} item={item} currency={q.currency} />
            ))}
          </div>

          <section className="flex flex-col gap-sm">
            <h2 className="text-section-label font-bold uppercase text-text-3">{t("checkout.delivery")}</h2>
            <div role="radiogroup" aria-label={t("checkout.delivery")} className="flex flex-col gap-sm">
              <MethodCard
                selected={method === "pickup_point"}
                icon={MapPin}
                title={t("checkout.pickup")}
                note={t("checkout.pickupNote")}
                price={optionPrice("pickup_point")}
                onClick={() => setMethod("pickup_point")}
              />
              <MethodCard
                selected={method === "home"}
                icon={Home}
                title={t("checkout.home")}
                note={t("checkout.homeNote")}
                price={optionPrice("home")}
                onClick={() => setMethod("home")}
              />
            </div>
          </section>

          {method === "home" ? (
            <section className="flex flex-col gap-sm">
              <h2 className="text-section-label font-bold uppercase text-text-3">{t("checkout.address")}</h2>
              {showForm ? (
                <div className="rounded-control border border-border p-md">
                  <h3 className="mb-md text-body font-semibold text-text-1">{t("address.addTitle")}</h3>
                  <AddressForm
                    defaultIsDefault={list.length === 0}
                    onCancel={list.length > 0 ? () => setAdding(false) : undefined}
                    onSaved={(created) => {
                      setPickedAddress(created.id);
                      setAdding(false);
                      setChoosing(false);
                    }}
                  />
                </div>
              ) : addresses.isPending ? (
                <Loader2
                  size={20}
                  className="animate-spin text-text-3 motion-reduce:animate-none"
                  aria-hidden
                />
              ) : choosing ? (
                <div role="radiogroup" aria-label={t("checkout.address")} className="flex flex-col gap-sm">
                  {list.map((a) => (
                    // biome-ignore lint/a11y/useSemanticElements: a card that acts as one choice of a radio group
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={address?.id === a.id}
                      onClick={() => {
                        setPickedAddress(a.id);
                        setChoosing(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-md rounded-control border p-md text-start",
                        address?.id === a.id
                          ? "border-primary bg-accent-tint"
                          : "border-border hover:bg-surface",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <AddressLines address={a} />
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex items-center gap-sm rounded-control border border-dashed border-text-4 p-md text-body font-semibold text-primary hover:bg-surface"
                  >
                    <Plus size={20} aria-hidden />
                    {t("checkout.newAddress")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-md rounded-control border border-border p-md">
                  <div className="min-w-0 flex-1">{address ? <AddressLines address={address} /> : null}</div>
                  <button
                    type="button"
                    onClick={() => setChoosing(true)}
                    aria-label={t("checkout.changeAddress")}
                    className="text-body-sm font-semibold text-primary hover:underline"
                  >
                    {t("checkout.change")}
                  </button>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-lg md:sticky md:top-28 md:self-start">
          <h2 className="text-section-label font-bold uppercase text-text-3">{t("checkout.summary")}</h2>
          <PriceBreakdown label={t("checkout.summary")} totals={{ ...q, itemsCount: q.items.length }} />
          <p className="flex items-center gap-xs text-card-desc text-text-3">
            <Timer size={14} aria-hidden />
            {t("checkout.holdNote", { minutes: q.holdMinutes })}
          </p>
          <SimulatedNote />
          {banner ? <Notice kind="error">{banner}</Notice> : null}
          {needsAddress ? (
            <p className="text-center text-card-desc text-text-3">{t("checkout.needAddress")}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void pay()}
            disabled={needsAddress || quote.isFetching || place.isPending}
            aria-busy={place.isPending}
            className={primaryButton}
          >
            {place.isPending ? (
              <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              t("checkout.pay", { amount: formatPrice(q.totalMinor, q.currency) })
            )}
          </button>
        </aside>
      </div>
    </main>
  );
}
