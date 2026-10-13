import { ONBOARDING_PICKS, type OnboardingPick } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { SizesStep } from "@/components/onboarding/sizes-step";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { useSaveOnboardingPicks } from "@/lib/feed-queries";
import { finishOnboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/**
 * Two short questions right after sign up, both skippable (D-022): what do you shop for, then your sizes.
 * The sizes come as an ink drawing, one picture per step (D-029).
 * Shown once for a new account. Both answers shape Home from the first day.
 */
export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [step, setStep] = useState<1 | 2>(1);
  const [picks, setPicks] = useState<OnboardingPick[]>([]);
  const savePicks = useSaveOnboardingPicks();

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

  return (
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
      {step === 1 ? (
        <>
          <ScrollView contentContainerClassName="px-lg pb-xl" showsVerticalScrollIndicator={false}>
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
                      on ? "border-primary bg-accent-tint" : "border-border bg-background active:bg-surface",
                    )}
                  >
                    <Text variant="heading">{t(`onboarding.shopFor.${pick}`)}</Text>
                    <Checkbox checked={on} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View className="px-lg pb-md">
            <Button size="lg" onPress={next}>
              <Text>{t("onboarding.continue")}</Text>
            </Button>
          </View>
        </>
      ) : (
        <SizesStep picks={picks} onDone={done} />
      )}
    </Screen>
  );
}
