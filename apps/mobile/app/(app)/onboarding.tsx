import { type BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { ONBOARDING_PICKS, type OnboardingPick, PERSONALISATION_SIZES_MAX } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { type Option, OptionListSheet } from "@/components/sell/option-list-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Row } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { useSaveOnboardingPicks } from "@/lib/feed-queries";
import { personalisationSizesQuery, useSavePersonalisationSizes } from "@/lib/item-queries";
import { finishOnboarding } from "@/lib/onboarding";
import { useLocalName, useReference } from "@/lib/reference";
import { buildSizeOptions, summariseSizes } from "@/lib/size-options";
import { cn } from "@/lib/utils";

/**
 * Two short questions right after sign up, both skippable (D-025): what do you shop for, then your sizes.
 * Shown once for a new account. Both answers shape Home from the first day.
 */
export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const name = useLocalName();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [step, setStep] = useState<1 | 2>(1);
  const [picks, setPicks] = useState<OnboardingPick[]>([]);
  const sheetRef = useRef<BottomSheetModal>(null);
  const savePicks = useSaveOnboardingPicks();
  const saveSizes = useSavePersonalisationSizes();
  const reference = useReference();
  const saved = useQuery(personalisationSizesQuery());

  const done = () => {
    if (userId) finishOnboarding(userId);
    router.back();
  };

  const next = () => {
    // Picking nothing is the same as skipping: nothing is sent.
    if (picks.length > 0) savePicks.mutate(picks);
    setStep(2);
  };

  const toggle = (pick: OnboardingPick) =>
    setPicks((current) => (current.includes(pick) ? current.filter((p) => p !== pick) : [...current, pick]));

  const options: Option[] = reference.data ? buildSizeOptions(reference.data.sizeGroups, name) : [];
  const sizeIds = saved.data?.sizeIds ?? [];
  const summary = summariseSizes(sizeIds, options, {
    none: t("shopping.none"),
    count: (count) => t("shopping.count", { count }),
  });

  return (
    // The screen is a full-screen modal above the app's sheet host, so it brings its own (see CLAUDE.md).
    <BottomSheetModalProvider>
      <Screen>
        <View className="h-12 flex-row items-center justify-between px-lg">
          <Text variant="bodySmall" className="text-text-3">
            {t("onboarding.step", { current: step, total: 2 })}
          </Text>
          <Pressable
            onPress={step === 1 ? () => setStep(2) : done}
            hitSlop={12}
            role="button"
            accessibilityLabel={t("onboarding.skip")}
          >
            <Text variant="bodySmall" weight={700} className="text-primary">
              {t("onboarding.skip")}
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerClassName="px-lg pb-xl" showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <>
              <Text variant="title" className="mt-lg" accessibilityRole="header">
                {t("onboarding.shopFor.title")}
              </Text>
              <Text variant="subtitle" className="mb-xl mt-sm">
                {t("onboarding.shopFor.subtitle")}
              </Text>
              <View className="gap-md">
                {ONBOARDING_PICKS.map((pick) => {
                  const on = picks.includes(pick);
                  return (
                    <Pressable
                      key={pick}
                      onPress={() => toggle(pick)}
                      role="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={t(`onboarding.shopFor.${pick}`)}
                      className={cn(
                        "min-h-[72px] flex-row items-center justify-between rounded-control border px-lg",
                        on
                          ? "border-primary bg-accent-tint"
                          : "border-border bg-background active:bg-surface",
                      )}
                    >
                      <Text variant="heading">{t(`onboarding.shopFor.${pick}`)}</Text>
                      <Checkbox checked={on} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text variant="title" className="mt-lg" accessibilityRole="header">
                {t("onboarding.sizes.title")}
              </Text>
              <Text variant="subtitle" className="mb-xl mt-sm">
                {t("onboarding.sizes.subtitle")}
              </Text>
              <View className="overflow-hidden rounded-control border border-border">
                <Row
                  label={t("shopping.pick")}
                  value={summary}
                  onPress={() => sheetRef.current?.present()}
                  last
                />
              </View>
            </>
          )}
        </ScrollView>
        <View className="px-lg pb-md">
          <Button size="lg" onPress={step === 1 ? next : done}>
            <Text>{step === 1 ? t("onboarding.continue") : t("onboarding.finish")}</Text>
          </Button>
        </View>
        <OptionListSheet
          ref={sheetRef}
          title={t("shopping.sizes")}
          options={options}
          mode="multi"
          max={PERSONALISATION_SIZES_MAX}
          selected={sizeIds}
          onChange={(ids) => saveSizes.mutate(ids)}
          header={
            <Text variant="bodySmall" className="text-text-3">
              {t("shopping.max", { count: PERSONALISATION_SIZES_MAX })}
            </Text>
          }
        />
      </Screen>
    </BottomSheetModalProvider>
  );
}
