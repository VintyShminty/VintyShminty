import { type BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { CheckCircle2 } from "lucide-react-native";
import { type Ref, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { describeApiError } from "@/lib/auth-errors";
import { formatMoney, minorToPriceText, priceTextToMinor } from "@/lib/money";
import { newIdempotencyKey, useWithdraw } from "@/lib/orders-queries";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

/** A pretend withdrawal: how much, an honest note that no bank is involved, and a thank you. */
export function WithdrawSheet({
  ref,
  availableMinor,
  currency,
}: {
  ref: Ref<BottomSheetModal>;
  availableMinor: number;
  currency: string;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const withdraw = useWithdraw();
  const [text, setText] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // One key per attempt: tapping twice, or retrying after a bad connection, still makes one withdrawal.
  const key = useRef(newIdempotencyKey());
  const isHe = i18n.language === "he";
  const amount = priceTextToMinor(text);
  const tooMuch = amount !== null && amount > availableMinor;
  const valid = amount !== null && amount > 0 && !tooMuch;

  const close = () => (ref && typeof ref === "object" ? ref.current?.dismiss() : undefined);
  const reset = () => {
    setText("");
    setDone(null);
    setErrorKey(null);
    withdraw.reset();
    key.current = newIdempotencyKey();
  };

  const send = () => {
    if (!valid || amount === null) return;
    setErrorKey(null);
    withdraw.mutate(
      { amountMinor: amount, key: key.current },
      {
        onSuccess: () => setDone(amount),
        onError: (err) =>
          setErrorKey(
            err instanceof ApiClientError && err.fields?.amountMinor
              ? "validation.withdrawal.tooMuch"
              : describeApiError(err).key,
          ),
      },
    );
  };

  return (
    <Sheet ref={ref} title={t("balance.withdrawTitle")} snapPoints={["70%"]} onDismiss={reset}>
      {done !== null ? (
        <View className="items-center gap-md px-xl pt-2xl">
          <Icon as={CheckCircle2} size={48} className="text-success" />
          <Text variant="heading" className="text-center">
            {t("balance.withdrawDone", { amount: formatMoney(done, currency) })}
          </Text>
          <Text className="text-center text-text-2">{t("balance.withdrawDoneNote")}</Text>
          <Button size="lg" className="mt-lg self-stretch" onPress={close}>
            <Text>{t("common.done")}</Text>
          </Button>
        </View>
      ) : (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="gap-lg px-lg pt-sm">
            <Banner variant="info">{t("balance.withdrawNote")}</Banner>
            <View className="gap-xs">
              <Text variant="bodySmall" weight={500} className="text-text-2">
                {t("balance.amount")}
              </Text>
              <View
                className={cn(
                  "h-12 flex-row items-center rounded-control border bg-background px-md",
                  tooMuch ? "border-error" : "border-border",
                )}
              >
                <Text weight={600} className="me-xs text-text-2">
                  {formatMoney(0, currency).replace("0", "")}
                </Text>
                <BottomSheetTextInput
                  value={text}
                  onChangeText={setText}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.text4}
                  selectionColor={colors.accent}
                  maxLength={9}
                  accessibilityLabel={t("balance.amount")}
                  className={cn("flex-1 text-body text-text-1", isHe ? "font-heebo-400" : "font-aileron-400")}
                  style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
                />
              </View>
              <View className="flex-row items-center justify-between gap-md">
                <Text variant="cardDesc" className={tooMuch ? "text-error" : "text-text-3"}>
                  {tooMuch
                    ? t("validation.withdrawal.tooMuch")
                    : t("balance.availableHint", { amount: formatMoney(availableMinor, currency) })}
                </Text>
                <Pressable
                  onPress={() => setText(minorToPriceText(availableMinor))}
                  hitSlop={8}
                  role="button"
                  disabled={availableMinor <= 0}
                >
                  <Text variant="cardDesc" weight={600} className="text-primary">
                    {t("balance.useAll")}
                  </Text>
                </Pressable>
              </View>
            </View>
            {errorKey ? <Banner variant="error">{t(errorKey)}</Banner> : null}
            <Button size="lg" disabled={!valid} loading={withdraw.isPending} onPress={send}>
              <Text>{t("balance.withdrawConfirm")}</Text>
            </Button>
          </View>
        </BottomSheetScrollView>
      )}
    </Sheet>
  );
}
