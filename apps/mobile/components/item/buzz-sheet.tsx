import { type BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/radio";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { bumpPlansQuery, useGiveBuzz } from "@/lib/bump-queries";
import { formatMoney } from "@/lib/money";
import { useLocalName } from "@/lib/reference";
import { cn } from "@/lib/utils";

/** The server's refusal, in words. */
function errorKeyFor(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === "network") return "errors.network";
    if (err.code === "conflict") {
      return err.message.includes("already") ? "buzz.errors.already" : "buzz.errors.unavailable";
    }
  }
  return "errors.general";
}

/**
 * The sheet to give an item buzz: the plans with how long they last and what they cost (Free for now), and one
 * confirm button. The first plan is picked already, so a single tap on the button is enough.
 */
function BuzzSheet({ ref, listingId }: { ref: Ref<BottomSheetModal>; listingId: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const name = useLocalName();
  const plans = useQuery(bumpPlansQuery());
  const give = useGiveBuzz();
  const [picked, setPicked] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const items = plans.data?.items ?? [];
  const chosen = picked ?? items[0]?.id ?? null;

  const confirm = () => {
    if (!chosen) return;
    setErrorKey(null);
    give.mutate(
      { listingId, planId: chosen },
      {
        onSuccess: () => {
          if (ref && typeof ref === "object") ref.current?.dismiss();
        },
        onError: (err) => setErrorKey(errorKeyFor(err)),
      },
    );
  };

  return (
    <Sheet
      ref={ref}
      title={t("buzz.title")}
      snapPoints={["58%"]}
      onDismiss={() => {
        setPicked(null);
        setErrorKey(null);
        give.reset();
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-lg px-lg pt-sm">
          <Text variant="bodySmall" className="text-text-2">
            {t("buzz.intro")}
          </Text>

          {plans.isPending ? (
            <Spinner />
          ) : plans.isError ? (
            <Banner variant="error">{t("buzz.plansFailed")}</Banner>
          ) : (
            <View className="gap-sm">
              {items.map((plan) => {
                const selected = plan.id === chosen;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setPicked(plan.id)}
                    role="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${name(plan.name)}, ${
                      plan.priceMinor === 0 ? t("buzz.free") : formatMoney(plan.priceMinor, plan.currency)
                    }`}
                    className={cn(
                      "flex-row items-center gap-md rounded-control border p-md",
                      selected ? "border-primary bg-accent-tint" : "border-border bg-background",
                    )}
                  >
                    <Radio checked={selected} />
                    <Text weight={600} className="flex-1">
                      {name(plan.name)}
                    </Text>
                    <Text variant="bodySmall" className="text-text-2">
                      {plan.priceMinor === 0 ? t("buzz.free") : formatMoney(plan.priceMinor, plan.currency)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {errorKey ? <Banner variant="error">{t(errorKey)}</Banner> : null}

          <Button size="lg" onPress={confirm} loading={give.isPending} disabled={!chosen}>
            <Text>{t("buzz.confirm")}</Text>
          </Button>
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
}

export { BuzzSheet };
