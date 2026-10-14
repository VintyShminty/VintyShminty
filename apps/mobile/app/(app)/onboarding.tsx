import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  ONBOARDING_PICKS,
  type OnboardingNameForm,
  type OnboardingPick,
  onboardingNameFormSchema,
} from "@vinty/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { FormInput } from "@/components/form-input";
import { SizesStep } from "@/components/onboarding/sizes-step";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { describeApiError } from "@/lib/auth-errors";
import { useSaveOnboardingPicks } from "@/lib/feed-queries";
import { finishOnboarding } from "@/lib/onboarding";
import { meQuery, useUpdateProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Three short steps right after sign up, all skippable (D-022): your first name and username, what you shop for,
 * then your sizes. The sizes come as an ink drawing, one picture per step (D-029).
 * Shown once for a new account. The shopping answers shape Home from the first day.
 */
export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [picks, setPicks] = useState<OnboardingPick[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const savePicks = useSaveOnboardingPicks();
  const { data: me } = useQuery(meQuery());
  const update = useUpdateProfile();
  // A new account's name starts as its username. Only a real name (Apple passes one) is worth prefilling.
  const realName = me && me.name !== me.username ? (me.name.trim().split(/\s+/)[0] ?? "") : "";
  const { control, handleSubmit, setError } = useForm<OnboardingNameForm>({
    resolver: zodResolver(onboardingNameFormSchema),
    mode: "onTouched",
    values: { name: realName, username: me?.username ?? "" },
    resetOptions: { keepDirtyValues: true },
  });

  const done = () => {
    if (userId) finishOnboarding(userId);
    router.back();
  };

  const saveName = handleSubmit(async ({ name, username }) => {
    setBanner(null);
    try {
      await update.mutateAsync(username === me?.username ? { name } : { name, username });
      setStep(2);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.username) {
        setError("username", { message: err.fields.username });
      } else {
        setBanner(t(describeApiError(err).key));
      }
    }
  });

  const next = () => {
    // Picking nothing is the same as skipping: nothing is sent.
    if (picks.length > 0) savePicks.mutate(picks);
    setStep(3);
  };

  const toggle = (pick: OnboardingPick) =>
    setPicks((current) => (current.includes(pick) ? current.filter((p) => p !== pick) : [...current, pick]));

  return (
    <Screen>
      <View className="h-12 flex-row items-center justify-between px-lg">
        <Text variant="bodySmall" className="text-text-3">
          {t("onboarding.step", { current: step, total: 3 })}
        </Text>
        <Pressable
          onPress={step === 3 ? done : () => setStep((step + 1) as 2 | 3)}
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
          <ScreenScroll>
            <Text variant="title" className="mt-lg" accessibilityRole="header">
              {t("onboarding.name.title")}
            </Text>
            <Text variant="subtitle" className="mb-xl mt-sm">
              {t("onboarding.name.subtitle")}
            </Text>
            {banner ? (
              <Banner variant="error" className="mb-lg">
                {banner}
              </Banner>
            ) : null}
            <View className="gap-lg">
              <FormInput
                control={control}
                name="name"
                label={t("onboarding.name.firstName")}
                hint={t("onboarding.name.firstNameHint")}
                autoCapitalize="words"
                autoComplete="given-name"
                returnKeyType="next"
              />
              <FormInput
                control={control}
                name="username"
                label={t("fields.username")}
                hint={t("fields.usernameHint")}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
            </View>
          </ScreenScroll>
          <View className="px-lg pb-md">
            <Button size="lg" loading={update.isPending} onPress={saveName}>
              <Text>{t("onboarding.continue")}</Text>
            </Button>
          </View>
        </>
      ) : step === 2 ? (
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
