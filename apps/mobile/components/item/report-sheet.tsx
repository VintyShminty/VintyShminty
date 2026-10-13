import { type BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { ReportReason, ReportTarget } from "@vinty/shared";
import { CheckCircle2 } from "lucide-react-native";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Radio } from "@/components/ui/radio";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { describeApiError } from "@/lib/auth-errors";
import { useReport } from "@/lib/item-queries";
import { colors } from "@/theme";

// Which reasons make sense for what is being reported. The server accepts any of them for any target.
const LISTING_REASONS: ReportReason[] = [
  "counterfeit",
  "prohibited_item",
  "misleading",
  "inappropriate",
  "spam",
  "scam_off_platform",
  "other",
];
const USER_REASONS: ReportReason[] = ["harassment", "scam_off_platform", "spam", "inappropriate", "other"];

type ReportSheetProps = {
  ref: Ref<BottomSheetModal>;
  targetType: Extract<ReportTarget, "listing" | "user">;
  targetId: string;
};

/**
 * Report flow (spec, "..." menu, Report): pick a reason, add optional details, send.
 * The server answers the same way when the same report is sent twice, so the thank you covers both.
 * A repeat that the server calls a conflict shows "already reported".
 */
function ReportSheet({ ref, targetType, targetId }: ReportSheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [outcome, setOutcome] = useState<"sent" | "already" | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const isHe = i18n.language === "he";
  const reasons = targetType === "listing" ? LISTING_REASONS : USER_REASONS;

  const close = () => (typeof ref === "object" && ref ? ref.current?.dismiss() : undefined);
  const reset = () => {
    setReason(null);
    setDetails("");
    setOutcome(null);
    setErrorKey(null);
    report.reset();
  };

  const send = () => {
    if (!reason) return;
    setErrorKey(null);
    report.mutate(
      { targetType, targetId, reason, details: details.trim() || undefined },
      {
        onSuccess: () => setOutcome("sent"),
        onError: (err) => {
          if (err instanceof ApiClientError && err.status === 409) return setOutcome("already");
          if (err instanceof ApiClientError && err.status === 400) return setErrorKey("report.own");
          if (err instanceof ApiClientError && err.status === 429) return setErrorKey("report.tooMany");
          setErrorKey(describeApiError(err).key);
        },
      },
    );
  };

  return (
    <Sheet ref={ref} title={t("report.title")} snapPoints={["85%"]} onDismiss={reset}>
      {outcome ? (
        <View className="items-center gap-md px-xl pt-2xl">
          <Icon as={CheckCircle2} size={48} className="text-success" />
          <Text variant="heading" className="text-center">
            {outcome === "sent" ? t("report.thanks") : t("report.already")}
          </Text>
          <Text className="text-center text-text-2">
            {outcome === "sent" ? t("report.thanksNote") : t("report.alreadyNote")}
          </Text>
          <Button size="lg" className="mt-lg self-stretch" onPress={close}>
            <Text>{t("report.done")}</Text>
          </Button>
        </View>
      ) : (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <Text variant="bodySmall" weight={600} className="px-lg pb-sm text-text-2">
            {t("report.question")}
          </Text>
          {reasons.map((key) => (
            <Pressable
              key={key}
              onPress={() => setReason(key)}
              role="radio"
              accessibilityState={{ checked: reason === key }}
              accessibilityLabel={t(`report.reasons.${key}`)}
              className="active:bg-surface"
            >
              <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg py-md">
                <Text className="flex-1">{t(`report.reasons.${key}`)}</Text>
                <Radio checked={reason === key} />
              </View>
            </Pressable>
          ))}

          <View className="gap-xs px-lg pt-xl">
            <Text variant="bodySmall" weight={500} className="text-text-2">
              {t("report.details")}
            </Text>
            <View className="min-h-[96px] rounded-control border border-border bg-background px-md py-sm">
              <BottomSheetTextInput
                value={details}
                onChangeText={setDetails}
                placeholder={t("report.detailsHint")}
                placeholderTextColor={colors.text4}
                selectionColor={colors.accent}
                multiline
                maxLength={2000}
                accessibilityLabel={t("report.details")}
                className={`min-h-[80px] text-body text-text-1 ${isHe ? "font-heebo-400" : "font-aileron-400"}`}
                textAlignVertical="top"
                style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
              />
            </View>
          </View>

          {errorKey ? (
            <View className="px-lg pt-lg">
              <Banner variant="error">{t(errorKey)}</Banner>
            </View>
          ) : null}

          <View className="px-lg pt-xl">
            <Button size="lg" disabled={!reason} loading={report.isPending} onPress={send}>
              <Text>{t("report.submit")}</Text>
            </Button>
          </View>
        </BottomSheetScrollView>
      )}
    </Sheet>
  );
}

export { ReportSheet };
