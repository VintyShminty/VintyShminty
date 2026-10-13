import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import type { OrderDetail, ReviewItem } from "@vinty/shared";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle, ShieldCheck, Star } from "lucide-react-native";
import { type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { NoteSheet } from "@/components/orders/note-sheet";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { ReplySheet } from "@/components/orders/reply-sheet";
import { ReviewSheet } from "@/components/orders/review-sheet";
import { EmptyState, LoadError } from "@/components/orders/states";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { StarRating } from "@/components/ui/star-rating";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { orderErrorKey, orderQuery, useOrderStep, useSimulateDelivery } from "@/lib/orders-queries";
import { formatDate } from "@/lib/time";
import { colors } from "@/theme";

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-md px-lg pt-xl">
      {title ? (
        <Text variant="sectionLabel" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function MoneyRow({
  label,
  amount,
  strong,
  negative,
  currency,
}: {
  label: string;
  amount: number;
  currency: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-md">
      <Text weight={strong ? 700 : 400} className={strong ? undefined : "text-text-2"}>
        {label}
      </Text>
      <Text weight={strong ? 700 : 500}>
        {negative ? "-" : ""}
        {formatMoney(amount, currency)}
      </Text>
    </View>
  );
}

/** A review shown on the order: stars, the words, and the reply if there is one. */
function ReviewCard({ title, review, onReply }: { title: string; review: ReviewItem; onReply?: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="gap-sm rounded-control border border-border-subtle p-md">
      <Text variant="bodySmall" weight={600}>
        {title}
      </Text>
      <View className="flex-row items-center gap-sm">
        <StarRating rating={review.rating} size={16} />
        {review.isAutomatic ? <Text variant="cardMeta">{t("profile.automatic")}</Text> : null}
      </View>
      {review.comment ? <Text variant="bodySmall">{review.comment}</Text> : null}
      {review.replyBody ? (
        <View className="rounded-control bg-surface p-md">
          <Text variant="cardMeta" weight={600} className="mb-xs">
            {t("profile.reply")}
          </Text>
          <Text variant="bodySmall">{review.replyBody}</Text>
        </View>
      ) : null}
      {onReply && !review.isAutomatic ? (
        <Button size="sm" variant="outline" className="self-start" onPress={onReply}>
          <Text>{review.replyBody ? t("review.editReply") : t("review.reply")}</Text>
        </Button>
      ) : null}
    </View>
  );
}

/** One order: what is in it, who with, where it stands, the money, and the buttons that make sense right now. */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const query = useQuery(orderQuery(id));
  const step = useOrderStep(id);
  const simulate = useSimulateDelivery(id);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const cancelSheet = useRef<BottomSheetModal>(null);
  const disputeSheet = useRef<BottomSheetModal>(null);
  const reviewSheet = useRef<BottomSheetModal>(null);
  const replySheet = useRef<BottomSheetModal>(null);
  const [replyTarget, setReplyTarget] = useState<ReviewItem | null>(null);
  const order = query.data;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const run = (input: Parameters<typeof step.mutate>[0], after?: () => void) => {
    setBannerKey(null);
    step.mutate(input, {
      onSuccess: () => after?.(),
      onError: (err) => {
        setBannerKey(orderErrorKey(err));
        after?.();
      },
    });
  };

  const confirm = (title: string, message: string, label: string, onPress: () => void, destructive = false) =>
    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel" },
      { text: label, style: destructive ? "destructive" : "default", onPress },
    ]);

  if (!order) {
    const notFound = query.error instanceof ApiClientError && query.error.status === 404;
    return (
      <Screen bottomInset={false}>
        <TopBar title={t("orders.orderTitle")} />
        {query.isPending ? (
          <Spinner size="large" />
        ) : notFound ? (
          <EmptyState title={t("orders.notFound")} note={t("orders.notFoundNote")} />
        ) : (
          <LoadError onRetry={() => void query.refetch()} />
        )}
      </Screen>
    );
  }

  const isSeller = order.role === "seller";
  const other = isSeller ? order.buyer : order.seller;
  const otherName = other.username ?? t("profile.deletedMember");
  const has = (a: OrderDetail["actions"][number]) => order.actions.includes(a);
  const addr = order.shippingAddress;
  const checkout = () =>
    // Checkout takes the waiting order's id and pays it.
    router.push({ pathname: "/checkout", params: { orderId: order.id } });
  const primary = has("pay") || has("ship") || has("confirm_received");
  const hasFooter = primary || has("cancel") || has("open_dispute");

  return (
    <Screen bottomInset={false}>
      <TopBar title={t("orders.orderNumber", { number: order.orderNumber })} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-2xl"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
          />
        }
      >
        {bannerKey ? (
          <View className="px-lg pt-sm">
            <Banner variant="error">{t(bannerKey)}</Banner>
          </View>
        ) : null}

        <View className="gap-sm px-lg pt-sm">
          <OrderStatusBadge status={order.status} role={order.role} />
          <Text variant="heading">{t(`orders.next.${order.status}.${order.role}`)}</Text>
          <Text variant="subtitle">
            {t(`orders.nextNote.${order.status}.${order.role}`, { name: otherName })}
          </Text>
          {order.payByAt && order.status === "pending_payment" ? (
            <Text variant="bodySmall" weight={600} className="text-warning">
              {t("orders.payBy", {
                time: new Date(order.payByAt).toLocaleTimeString(i18n.language, {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </Text>
          ) : null}
        </View>

        <View className="px-lg pt-lg">
          <Banner variant="info">{t("orders.pretendNote")}</Banner>
        </View>

        <Section title={t("orders.progress")}>
          <OrderTimeline order={order} />
        </Section>

        <Section title={t("orders.items", { count: order.items.length })}>
          {order.items.map((line) => (
            <Pressable
              key={line.listingId ?? line.title}
              disabled={!line.listingId}
              onPress={() =>
                line.listingId && router.push({ pathname: "/listing/[id]", params: { id: line.listingId } })
              }
              role="button"
              className="flex-row items-center gap-md active:opacity-70"
            >
              <View className="h-16 w-16 overflow-hidden rounded-control bg-pressed">
                {line.photoUrl ? (
                  <Image
                    source={{ uri: line.photoUrl }}
                    style={{ width: 64, height: 64 }}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
              </View>
              <View className="flex-1 gap-xs">
                <Text weight={600} numberOfLines={2}>
                  {line.title}
                </Text>
                <Text variant="cardMeta" numberOfLines={1}>
                  {[line.brand, line.size].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text weight={600}>{formatMoney(line.priceMinor, order.currency)}</Text>
            </Pressable>
          ))}
        </Section>

        <Section title={isSeller ? t("orders.buyer") : t("orders.seller")}>
          <View className="flex-row items-center gap-md">
            <Pressable
              onPress={() => router.push({ pathname: "/user/[id]", params: { id: other.id } })}
              role="button"
              accessibilityLabel={t("orders.openProfile", { name: otherName })}
              className="flex-1 flex-row items-center gap-md active:opacity-70"
            >
              <Avatar uri={other.avatarUrl} name={otherName} size={44} />
              <Text weight={600} className="flex-1" numberOfLines={1}>
                {otherName}
              </Text>
              <ForwardIcon />
            </Pressable>
          </View>
          {order.conversationId ? (
            <Button
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: "/conversation/[id]",
                  params: { id: order.conversationId as string },
                })
              }
            >
              <Icon as={MessageCircle} size={18} className="text-primary" />
              <Text>{t("orders.message", { name: otherName })}</Text>
            </Button>
          ) : null}
        </Section>

        <Section title={t("orders.price")}>
          <View className="gap-sm">
            <MoneyRow
              label={t("orders.itemsSubtotal")}
              amount={order.itemsSubtotalMinor}
              currency={order.currency}
            />
            {order.bundleDiscountMinor > 0 ? (
              <MoneyRow
                label={t("orders.bundleDiscount")}
                amount={order.bundleDiscountMinor}
                currency={order.currency}
                negative
              />
            ) : null}
            {!isSeller ? (
              <>
                <MoneyRow
                  label={t("orders.protection")}
                  amount={order.buyerProtectionFeeMinor}
                  currency={order.currency}
                />
                <MoneyRow
                  label={t("orders.shipping")}
                  amount={order.shippingMinor}
                  currency={order.currency}
                />
                {order.voucherDiscountMinor > 0 ? (
                  <MoneyRow
                    label={t("orders.voucher")}
                    amount={order.voucherDiscountMinor}
                    currency={order.currency}
                    negative
                  />
                ) : null}
              </>
            ) : null}
            <View className="border-t border-border-subtle pt-sm">
              {isSeller && order.sellerEarningsMinor !== null ? (
                <MoneyRow
                  strong
                  label={t("orders.youEarn")}
                  amount={order.sellerEarningsMinor}
                  currency={order.currency}
                />
              ) : (
                <MoneyRow
                  strong
                  label={t("orders.total")}
                  amount={order.totalMinor}
                  currency={order.currency}
                />
              )}
            </View>
          </View>
          {!isSeller ? (
            <View className="flex-row items-center gap-xs">
              <Icon as={ShieldCheck} size={14} className="text-text-3" />
              <Text variant="cardMeta">{t("orders.protectionNote")}</Text>
            </View>
          ) : null}
        </Section>

        <Section title={t("orders.delivery")}>
          <Text weight={600}>{t(`orders.deliveryMethod.${order.deliveryMethod}`)}</Text>
          {addr ? (
            <View className="gap-xs">
              <Text>{addr.fullName}</Text>
              <Text className="text-text-2">{addr.line1}</Text>
              {addr.line2 ? <Text className="text-text-2">{addr.line2}</Text> : null}
              <Text className="text-text-2">
                {addr.postcode} {addr.city}
              </Text>
              <Text className="text-text-2">
                {t(`countries.${addr.countryCode}`, { defaultValue: addr.countryCode })}
              </Text>
              {addr.phone ? <Text className="text-text-2">{addr.phone}</Text> : null}
            </View>
          ) : (
            <Text variant="bodySmall" className="text-text-3">
              {t("orders.noAddress")}
            </Text>
          )}
          {order.shipment?.trackingCode ? (
            <View className="gap-xs rounded-control bg-surface p-md">
              <Text variant="cardMeta">{t("orders.tracking")}</Text>
              <Text weight={700} selectable>
                {order.shipment.trackingCode}
              </Text>
              {order.shipment.simulated ? <Text variant="cardMeta">{t("orders.pretendParcel")}</Text> : null}
            </View>
          ) : null}
          {__DEV__ && order.status === "shipped" ? (
            <Pressable
              onPress={() => simulate.mutate()}
              disabled={simulate.isPending}
              role="button"
              hitSlop={8}
              className="self-start py-xs"
            >
              <Text variant="bodySmall" weight={600} className="text-primary underline">
                {t("orders.simulateDelivery")}
              </Text>
            </Pressable>
          ) : null}
        </Section>

        {order.canReview || order.reviews.mine || order.reviews.theirs ? (
          <Section title={t("orders.feedback")}>
            {order.canReview ? (
              <View className="gap-md rounded-control bg-accent-tint p-md">
                <Text weight={600}>{t("review.prompt", { name: otherName })}</Text>
                <Button onPress={() => reviewSheet.current?.present()}>
                  <Icon as={Star} size={18} className="text-primary-foreground" />
                  <Text>{t("review.leave")}</Text>
                </Button>
              </View>
            ) : null}
            {order.reviews.mine ? <ReviewCard title={t("review.yours")} review={order.reviews.mine} /> : null}
            {order.reviews.theirs ? (
              <ReviewCard
                title={t("review.theirs", { name: otherName })}
                review={order.reviews.theirs}
                onReply={() => {
                  setReplyTarget(order.reviews.theirs);
                  replySheet.current?.present();
                }}
              />
            ) : null}
          </Section>
        ) : null}

        <Section>
          <Text variant="cardMeta">
            {t("orders.placedOn", {
              date: formatDate(order.createdAt, i18n.language),
              number: order.orderNumber,
            })}
          </Text>
        </Section>
      </ScrollView>

      {hasFooter ? (
        <View className="gap-sm border-t border-border-subtle bg-background px-lg py-md">
          {has("pay") ? (
            <Button size="lg" onPress={checkout}>
              <Text>{t("orders.pay")}</Text>
            </Button>
          ) : null}
          {has("ship") ? (
            <Button
              size="lg"
              loading={step.isPending}
              onPress={() =>
                confirm(t("orders.shipConfirmTitle"), t("orders.shipConfirmNote"), t("orders.ship"), () =>
                  run({ step: "ship" }),
                )
              }
            >
              <Text>{t("orders.ship")}</Text>
            </Button>
          ) : null}
          {has("confirm_received") ? (
            <Button
              size="lg"
              loading={step.isPending}
              onPress={() =>
                confirm(
                  t("orders.receivedConfirmTitle"),
                  t("orders.receivedConfirmNote"),
                  t("orders.received"),
                  () => run({ step: "confirm-received" }),
                )
              }
            >
              <Text>{t("orders.received")}</Text>
            </Button>
          ) : null}
          {has("open_dispute") ? (
            <Button variant="ghost" onPress={() => disputeSheet.current?.present()}>
              <Text>{t("orders.dispute")}</Text>
            </Button>
          ) : null}
          {has("cancel") ? (
            <Button variant="ghost" onPress={() => cancelSheet.current?.present()}>
              <Text className="text-destructive">{t("orders.cancel")}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}

      <NoteSheet
        ref={cancelSheet}
        title={t("orders.cancelTitle")}
        intro={t(isSeller ? "orders.cancelIntroSeller" : "orders.cancelIntroBuyer")}
        label={t("orders.cancelReasonLabel")}
        placeholder={t("orders.cancelReasonHint")}
        maxLength={300}
        confirmLabel={t("orders.cancelConfirm")}
        destructive
        loading={step.isPending}
        snapPoints={["70%"]}
        onSubmit={(reason) => run({ step: "cancel", reason }, () => cancelSheet.current?.dismiss())}
      />
      <NoteSheet
        ref={disputeSheet}
        title={t("orders.disputeTitle")}
        intro={t("orders.disputeIntro")}
        label={t("orders.disputeDetails")}
        placeholder={t("orders.disputeHint")}
        required
        maxLength={1000}
        confirmLabel={t("orders.disputeConfirm")}
        loading={step.isPending}
        snapPoints={["75%"]}
        onSubmit={(details) => run({ step: "dispute", details }, () => disputeSheet.current?.dismiss())}
      />
      <ReviewSheet
        ref={reviewSheet}
        orderId={order.id}
        otherName={otherName}
        onDone={() => void query.refetch()}
      />
      <ReplySheet ref={replySheet} review={replyTarget} />
    </Screen>
  );
}
