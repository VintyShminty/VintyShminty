import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { DeliveryMethod, OrderDetail } from "@vinty/shared";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Home, Info, MapPin, PackageOpen, Timer } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddressLines } from "@/components/checkout/address-card";
import { PriceBreakdown } from "@/components/checkout/price-breakdown";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Radio } from "@/components/ui/radio";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { newClientMessageId } from "@/lib/chat-send";
import { useCheckoutStore } from "@/lib/checkout-store";
import { formatMoney } from "@/lib/money";
import {
  type CheckoutTarget,
  checkoutQuoteQuery,
  usePayOrder,
  usePlaceOrder,
} from "@/lib/order-flow-queries";
import { addressesQuery, orderQuery } from "@/lib/orders-queries";
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

function ProblemView({
  problem,
  onRetry,
  onClose,
}: {
  problem: Problem;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-md px-xl">
      <Icon as={PackageOpen} size={48} className="text-text-3" />
      <Text variant="heading" className="text-center">
        {t(`checkout.problem.${problem}Title`)}
      </Text>
      <Text className="text-center text-text-2">{t(`checkout.problem.${problem}Note`)}</Text>
      {problem === "generic" ? (
        <Button variant="outline" onPress={onRetry}>
          <Text>{t("common.tryAgain")}</Text>
        </Button>
      ) : null}
      <Button onPress={onClose}>
        <Text>{t("checkout.problem.close")}</Text>
      </Button>
    </View>
  );
}

function ItemRow({ item, currency }: { item: OrderDetail["items"][number]; currency: string }) {
  return (
    <View className="flex-row items-center gap-md">
      <View className="h-16 w-16 overflow-hidden rounded-control bg-pressed">
        {item.photoUrl ? (
          <Image
            source={{ uri: item.photoUrl }}
            style={{ width: 64, height: 64 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
      <View className="flex-1 gap-px">
        <Text weight={600} numberOfLines={2}>
          {item.title}
        </Text>
        {item.brand || item.size ? (
          <Text variant="cardMeta" numberOfLines={1}>
            {[item.brand, item.size].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
      <Text weight={700}>{formatMoney(item.priceMinor, currency)}</Text>
    </View>
  );
}

function MethodCard({
  selected,
  icon,
  title,
  note,
  price,
  onPress,
}: {
  selected: boolean;
  icon: typeof Home;
  title: string;
  note: string;
  price: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}, ${price}`}
      className={cn(
        "flex-row items-center gap-md rounded-control border p-md",
        selected ? "border-primary bg-accent-tint" : "border-border bg-background active:bg-surface",
      )}
    >
      <Icon as={icon} size={22} className="text-text-2" />
      <View className="flex-1 gap-px">
        <Text weight={600}>{title}</Text>
        <Text variant="cardDesc">{note}</Text>
      </View>
      <Text variant="bodySmall" weight={600}>
        {price}
      </Text>
      <Radio checked={selected} />
    </Pressable>
  );
}

function SimulatedNote() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-start gap-sm rounded-control border border-border bg-accent-tint p-md">
      <Icon as={Info} size={18} className="mt-px text-primary" />
      <View className="flex-1 gap-xs">
        <Text variant="bodySmall" weight={600} className="text-primary">
          {t("checkout.simulatedTitle")}
        </Text>
        <Text variant="bodySmall" className="text-text-2">
          {t("checkout.simulatedNote")}
        </Text>
      </View>
    </View>
  );
}

/** Pay an order that already exists (the order page's Pay button). Shows its summary and pays it, once. */
function PayExisting({
  orderId,
  order,
  close,
}: {
  orderId: string;
  order: UseQueryResult<OrderDetail>;
  close: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pay = usePayOrder();
  const inFlight = useRef(false);
  const key = useRef(newClientMessageId());
  const [banner, setBanner] = useState<string | null>(null);
  const o = order.data;

  if (!o) {
    return (
      <Screen>
        <TopBar leading="close" title={t("checkout.title")} />
        {order.isError ? (
          <ProblemView
            problem={
              order.error instanceof ApiClientError && order.error.status === 404 ? "unavailable" : "generic"
            }
            onRetry={() => void order.refetch()}
            onClose={close}
          />
        ) : (
          <Spinner size="large" />
        )}
      </Screen>
    );
  }
  // Paid already (maybe on another phone) or closed: nothing to pay, show the order.
  if (o.status !== "pending_payment" || !o.actions.includes("pay")) {
    return (
      <Screen>
        <TopBar leading="close" title={t("checkout.title")} />
        <ProblemView problem="unavailable" onRetry={close} onClose={close} />
      </Screen>
    );
  }

  const submit = async () => {
    if (inFlight.current || pay.isPending) return;
    inFlight.current = true;
    setBanner(null);
    try {
      const paid = await pay.mutateAsync({ orderId, key: key.current });
      router.replace({ pathname: "/checkout/done", params: { orderId: paid.id } });
    } catch (err) {
      // If the order closed meanwhile, the reloaded order turns this screen into the "taken" view by itself.
      if (err instanceof ApiClientError && err.code === "network") setBanner(t("errors.network"));
      else setBanner(t("errors.general"));
    } finally {
      inFlight.current = false;
    }
  };

  const home = o.deliveryMethod === "home";
  return (
    <Screen bottomInset={false}>
      <TopBar leading="back" title={t("checkout.title")} />
      <ScreenScroll contentContainerClassName="gap-xl pb-xl pt-sm">
        <View className="gap-md">
          {o.items.map((item) => (
            <ItemRow key={item.listingId ?? item.title} item={item} currency={o.currency} />
          ))}
        </View>

        <View className="gap-sm">
          <Text variant="sectionLabel">{t("checkout.delivery")}</Text>
          <View className="flex-row items-center gap-md rounded-control border border-border p-md">
            <Icon as={home ? Home : MapPin} size={22} className="text-text-2" />
            <View className="flex-1 gap-px">
              <Text weight={600}>{home ? t("checkout.home") : t("checkout.pickup")}</Text>
              <Text variant="cardDesc">{home ? t("checkout.homeNote") : t("checkout.pickupNote")}</Text>
            </View>
          </View>
          {home && o.shippingAddress ? (
            <View className="rounded-control border border-border p-md">
              <AddressLines address={o.shippingAddress} />
            </View>
          ) : null}
        </View>

        <View className="gap-sm">
          <Text variant="sectionLabel">{t("checkout.summary")}</Text>
          <PriceBreakdown quote={o} />
        </View>

        <SimulatedNote />

        {banner ? <Banner variant="error">{banner}</Banner> : null}
      </ScreenScroll>

      <View
        className="gap-sm border-t border-border-subtle bg-background px-lg pt-md"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button size="lg" loading={pay.isPending} onPress={() => void submit()}>
          <Text>{t("checkout.pay", { amount: formatMoney(o.totalMinor, o.currency) })}</Text>
        </Button>
      </View>
    </Screen>
  );
}

/**
 * Checkout (docs/components.md, Checkout): what you are buying, how it gets to you, where to, the honest price
 * breakdown and Pay. Reached from Buy now on the item page, an accepted offer in the chat, or a bundle. Paying is
 * pretend in this version and the screen says so.
 */
export default function Checkout() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    listingId?: string;
    offerId?: string;
    bundleId?: string;
    orderId?: string;
  }>();
  const target: CheckoutTarget | null = params.offerId
    ? { offerId: params.offerId }
    : params.bundleId
      ? { bundleId: params.bundleId }
      : params.listingId
        ? { listingId: params.listingId }
        : null;
  // An order that already exists and waits for payment (opened from the order page): nothing to choose, only to pay.
  const existingId = params.orderId ?? null;
  const existing = useQuery({ ...orderQuery(existingId ?? "none"), enabled: existingId !== null });
  const [method, setMethod] = useState<DeliveryMethod>("pickup_point");
  const pickedAddress = useCheckoutStore((s) => s.addressId);
  const [banner, setBanner] = useState<string | null>(null);
  const [soldOut, setSoldOut] = useState(false);
  const place = usePlaceOrder();
  const inFlight = useRef(false);
  // One key per checkout screen. It changes with what is being ordered, so a changed address never gets an old order.
  const base = useRef(newClientMessageId());

  const quote = useQuery({
    ...checkoutQuoteQuery(target ?? { listingId: "none" }, method),
    enabled: target !== null && existingId === null,
  });
  const addresses = useQuery({ ...addressesQuery(), enabled: existingId === null });
  const list = addresses.data ?? [];
  const address =
    list.find((a) => a.id === pickedAddress) ?? list.find((a) => a.isDefault) ?? list[0] ?? null;
  const needsAddress = method === "home" && !address;

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (existingId) return <PayExisting orderId={existingId} order={existing} close={close} />;

  if (!target) {
    return (
      <Screen>
        <TopBar leading="close" title={t("checkout.title")} />
        <ProblemView problem="unavailable" onRetry={close} onClose={close} />
      </Screen>
    );
  }

  const problem = soldOut ? "unavailable" : quote.isError && !quote.data ? problemOf(quote.error) : null;
  if (problem) {
    return (
      <Screen>
        <TopBar leading="close" title={t("checkout.title")} />
        <ProblemView
          problem={problem}
          onRetry={() => {
            setSoldOut(false);
            void quote.refetch();
          }}
          onClose={close}
        />
      </Screen>
    );
  }
  const q = quote.data;
  if (!q) {
    return (
      <Screen>
        <TopBar leading="close" title={t("checkout.title")} />
        <Spinner size="large" />
      </Screen>
    );
  }

  const pay = async () => {
    // A second tap while the first is working must never make a second order.
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
          t("checkout.priceChanged", { total: formatMoney(fresh.data.totalMinor, fresh.data.currency) }),
        );
        return;
      }
      const order = await place.mutateAsync({
        target,
        deliveryMethod: method,
        addressId: method === "home" ? (address?.id ?? null) : null,
        key: `${base.current}-${method}-${method === "home" ? (address?.id ?? "x") : "x"}`,
      });
      router.replace({ pathname: "/checkout/done", params: { orderId: order.id } });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "listing_unavailable") setSoldOut(true);
      else if (err instanceof ApiClientError && err.code === "invalid_transition") {
        // The 30 minute hold ran out: the next try starts a fresh checkout.
        base.current = newClientMessageId();
        setBanner(t("checkout.timedOut"));
      } else if (err instanceof ApiClientError && err.code === "network") setBanner(t("errors.network"));
      else setBanner(t("errors.general"));
    } finally {
      inFlight.current = false;
    }
  };

  const optionPrice = (m: DeliveryMethod) => {
    const option = q.deliveryOptions.find((o) => o.method === m);
    return formatMoney(option?.priceMinor ?? q.shippingMinor, q.currency);
  };

  return (
    <Screen bottomInset={false}>
      <TopBar leading="back" title={t("checkout.title")} />
      <ScreenScroll contentContainerClassName="gap-xl pb-xl pt-sm">
        <View className="gap-md">
          {q.items.map((item) => (
            <ItemRow key={item.listingId ?? item.title} item={item} currency={q.currency} />
          ))}
        </View>

        <View className="gap-sm">
          <Text variant="sectionLabel">{t("checkout.delivery")}</Text>
          <MethodCard
            selected={method === "pickup_point"}
            icon={MapPin}
            title={t("checkout.pickup")}
            note={t("checkout.pickupNote")}
            price={optionPrice("pickup_point")}
            onPress={() => setMethod("pickup_point")}
          />
          <MethodCard
            selected={method === "home"}
            icon={Home}
            title={t("checkout.home")}
            note={t("checkout.homeNote")}
            price={optionPrice("home")}
            onPress={() => setMethod("home")}
          />
        </View>

        {method === "home" ? (
          <View className="gap-sm">
            <Text variant="sectionLabel">{t("checkout.address")}</Text>
            <Pressable
              onPress={() => router.push("/checkout/address")}
              role="button"
              accessibilityLabel={address ? t("checkout.changeAddress") : t("checkout.addAddress")}
              className="flex-row items-center gap-md rounded-control border border-border p-md active:bg-surface"
            >
              <View className="flex-1">
                {address ? (
                  <AddressLines address={address} />
                ) : (
                  <Text weight={600} className="text-primary">
                    {t("checkout.addAddress")}
                  </Text>
                )}
              </View>
              {address ? (
                <Text variant="bodySmall" weight={600} className="text-primary">
                  {t("checkout.change")}
                </Text>
              ) : null}
              <ForwardIcon />
            </Pressable>
          </View>
        ) : null}

        <View className="gap-sm">
          <Text variant="sectionLabel">{t("checkout.summary")}</Text>
          <PriceBreakdown quote={q} />
          <View className="flex-row items-center gap-xs pt-xs">
            <Icon as={Timer} size={14} className="text-text-3" />
            <Text variant="cardDesc" className="flex-1 text-text-3">
              {t("checkout.holdNote", { minutes: q.holdMinutes })}
            </Text>
          </View>
        </View>

        <SimulatedNote />

        {banner ? <Banner variant="error">{banner}</Banner> : null}
      </ScreenScroll>

      <View
        className="gap-sm border-t border-border-subtle bg-background px-lg pt-md"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {needsAddress ? (
          <Text variant="cardDesc" className="text-center text-text-3">
            {t("checkout.needAddress")}
          </Text>
        ) : null}
        <Button
          size="lg"
          disabled={needsAddress || quote.isFetching}
          loading={place.isPending}
          onPress={() => void pay()}
        >
          <Text>{t("checkout.pay", { amount: formatMoney(q.totalMinor, q.currency) })}</Text>
        </Button>
      </View>
    </Screen>
  );
}
