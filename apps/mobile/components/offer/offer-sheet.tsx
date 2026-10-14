import { type BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { QUICK_OFFER_PERCENT, quickOfferAmount } from "@vinty/shared";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PricePill } from "@/components/price-pill";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { formatClock } from "@/lib/chat-format";
import { formatMoney, minorToPriceText, priceTextToMinor } from "@/lib/money";
import { offerQuotaQuery } from "@/lib/order-flow-queries";
import { pricePreviewQuery } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

type OfferSheetProps = {
  ref: Ref<BottomSheetModal>;
  /** make: the buyer's first offer. counter: an answer to the other person's offer. */
  mode: "make" | "counter";
  listingPriceMinor: number;
  currency: string;
  /** Sends the amount. Throws when the server says no, the sheet shows why. */
  onSend: (amountMinor: number) => Promise<void>;
  /** Buyers have a daily limit. Counters from a seller are not counted, so they show no limit line. */
  showQuota: boolean;
};

/** The server's refusal, in words. */
function errorKeyFor(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === "network") return "errors.network";
    if (err.code === "offer_limit_reached" || err.status === 429) return "offer.errors.limit";
    if (err.code === "listing_unavailable") return "offer.errors.unavailable";
    if (err.code === "conflict") return "offer.errors.pending";
    if (err.code === "invalid_transition") return "offer.errors.closed";
    if (err.code === "forbidden") return "offer.errors.forbidden";
    if (err.fields?.amountMinor === "validation.offer.belowPrice") return "offer.errors.belowPrice";
    if (err.fields?.amountMinor === "validation.offer.positive") return "offer.errors.positive";
  }
  return "errors.general";
}

/**
 * The sheet to make or counter an offer (docs/components.md, OfferSheet): quick tiles with the price they work out to,
 * a price field, what the buyer would pay with protection, the offers left today, and the Send button that repeats
 * the amount.
 */
function OfferSheet({ ref, mode, listingPriceMinor, currency, onSend, showQuota }: OfferSheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHe = i18n.language === "he";
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const quota = useQuery({ ...offerQuotaQuery(), enabled: showQuota });

  const amount = priceTextToMinor(text);
  const debounced = useDebounced(amount);
  const preview = useQuery({
    ...pricePreviewQuery(debounced ?? 0),
    enabled: debounced !== null && debounced > 0 && debounced < listingPriceMinor,
  });

  let fieldError: string | null = null;
  if (amount !== null && amount <= 0) fieldError = t("offer.errors.positive");
  else if (amount !== null && amount >= listingPriceMinor) {
    fieldError = t("offer.errors.belowPrice", { price: formatMoney(listingPriceMinor, currency) });
  }
  const valid = amount !== null && amount > 0 && amount < listingPriceMinor;
  const noneLeft = showQuota && quota.data !== undefined && quota.data.remaining <= 0;

  const reset = () => {
    setText("");
    setTouched(false);
    setServerError(null);
    setBusy(false);
  };

  const send = async () => {
    if (!valid || busy || noneLeft) return;
    setBusy(true);
    setServerError(null);
    try {
      await onSend(amount);
      if (ref && typeof ref === "object") ref.current?.dismiss();
    } catch (err) {
      setServerError(errorKeyFor(err));
      void quota.refetch();
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "make" ? t("offer.title") : t("offer.counterTitle");

  return (
    <Sheet ref={ref} title={title} snapPoints={["78%"]} onDismiss={reset}>
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="gap-lg px-lg pt-sm">
          <Text variant="bodySmall" className="text-text-2">
            {t("offer.listedAt", { price: formatMoney(listingPriceMinor, currency) })}
          </Text>

          <View className="flex-row gap-sm">
            {QUICK_OFFER_PERCENT.map((percent) => {
              const value = quickOfferAmount(listingPriceMinor, percent);
              const selected = amount === value;
              return (
                <Pressable
                  key={percent}
                  onPress={() => {
                    setText(minorToPriceText(value));
                    setTouched(true);
                    setServerError(null);
                  }}
                  role="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${formatMoney(value, currency)}, ${t("offer.percentOff", { percent })}`}
                  className={cn(
                    "flex-1 items-center rounded-control border px-sm py-md",
                    selected
                      ? "border-primary bg-accent-tint"
                      : "border-border bg-background active:bg-surface",
                  )}
                >
                  <Text weight={700}>{formatMoney(value, currency)}</Text>
                  <Text variant="cardMeta">{t("offer.percentOff", { percent })}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="gap-xs">
            <Text variant="bodySmall" weight={500} className="text-text-2">
              {t("offer.yourPrice")}
            </Text>
            <View
              className={cn(
                "h-14 flex-row items-center rounded-control border bg-background px-md",
                touched && fieldError ? "border-error" : "border-primary",
              )}
            >
              <Text variant="heading" className="me-xs text-text-2">
                ₪
              </Text>
              <BottomSheetTextInput
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  setTouched(true);
                  setServerError(null);
                }}
                placeholder={t("offer.placeholder")}
                placeholderTextColor={colors.text4}
                selectionColor={colors.accent}
                keyboardType="decimal-pad"
                accessibilityLabel={t("offer.yourPrice")}
                maxLength={9}
                className={cn(
                  "flex-1 text-heading text-text-1",
                  isHe ? "font-heebo-700" : "font-aileron-700",
                )}
                style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
              />
            </View>
            {touched && fieldError ? (
              <Text variant="cardDesc" className="text-error" accessibilityLiveRegion="polite">
                {fieldError}
              </Text>
            ) : preview.data && valid ? (
              <PricePill
                className="self-start"
                amountMinor={preview.data.buyerPriceMinor}
                currency={preview.data.currency}
              />
            ) : null}
          </View>

          {serverError ? <Banner variant="error">{t(serverError)}</Banner> : null}

          <Button size="lg" disabled={!valid || noneLeft} loading={busy} onPress={() => void send()}>
            <Text>
              {valid ? t("offer.sendAmount", { amount: formatMoney(amount, currency) }) : t("offer.send")}
            </Text>
          </Button>

          {showQuota && quota.data ? (
            <Text variant="cardDesc" className="text-center text-text-3">
              {noneLeft
                ? t("offer.noneLeft", { time: formatClock(quota.data.resetsAt, i18n.language) })
                : t("offer.left", { count: quota.data.remaining })}
            </Text>
          ) : null}
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
}

export { OfferSheet };
