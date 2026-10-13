import { useQuery } from "@tanstack/react-query";
import { type OnboardingPick, PERSONALISATION_SIZES_MAX } from "@vinty/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { BodyFigure } from "@/components/onboarding/body-figure";
import { FIGURE_KIND, SIZE_STEPS, type SizeFigure } from "@/components/onboarding/size-steps";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { personalisationSizesQuery, useSavePersonalisationSizes } from "@/lib/item-queries";
import { useLocalName, useReference } from "@/lib/reference";
import { cn } from "@/lib/utils";

const FIGURES: SizeFigure[] = ["women", "men", "kids"];

/** The small row of dots under the figure, the current one is longer and espresso. */
function Progress({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const dots = Array.from({ length: total }, (_, i) => i);
  return (
    <View
      className="h-2 flex-row items-center justify-center gap-sm"
      accessibilityRole="progressbar"
      accessibilityLabel={t("onboarding.sizes.progress", { current: current + 1, total })}
    >
      {dots.map((dot) => (
        <View
          key={dot}
          className={cn("h-2 rounded-full", dot === current ? "w-6 bg-primary" : "w-2 bg-border")}
        />
      ))}
    </View>
  );
}

/**
 * The sizes question of the sign up flow (D-026). One body figure, and one part of it glows at a time while you pick
 * the sizes that belong to that part. With more than one pick in "What do you shop for?" it first asks whose sizes.
 * The sizes are saved the same way as in Settings (My sizes), after each part.
 */
export function SizesStep({ picks, onDone }: { picks: OnboardingPick[]; onDone: () => void }) {
  const { t } = useTranslation();
  const name = useLocalName();
  const still = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const reference = useReference();
  const saved = useQuery(personalisationSizesQuery());
  const save = useSavePersonalisationSizes();
  const [who, setWho] = useState<SizeFigure | null>(picks.length === 1 ? (picks[0] as SizeFigure) : null);
  const [choice, setChoice] = useState<SizeFigure | null>(picks[0] ?? null);
  const [index, setIndex] = useState(0);
  // What is ticked now. Stays empty until the first tap, so the saved sizes are used until then.
  const [ticked, setTicked] = useState<string[] | null>(null);
  const sizeIds = ticked ?? saved.data?.sizeIds ?? [];

  if (!reference.data) return <Spinner className="flex-1" />;

  if (!who) {
    return (
      <View className="flex-1 px-lg">
        <View className="flex-1">
          <Text variant="title" className="mt-lg" accessibilityRole="header">
            {t("onboarding.sizes.whoTitle")}
          </Text>
          <Text variant="subtitle" className="mb-xl mt-sm">
            {t("onboarding.sizes.whoSubtitle")}
          </Text>
          <View className="flex-row flex-wrap gap-sm">
            {FIGURES.map((figure) => (
              <Chip
                key={figure}
                label={t(`onboarding.shopFor.${figure}`)}
                selected={choice === figure}
                onPress={() => setChoice(figure)}
              />
            ))}
          </View>
        </View>
        <View className="pb-md">
          <Button size="lg" disabled={!choice} onPress={() => choice && setWho(choice)}>
            <Text>{t("onboarding.continue")}</Text>
          </Button>
        </View>
      </View>
    );
  }

  // Only the groups that really exist in the reference data, and only steps that have something to pick.
  const steps = SIZE_STEPS[who]
    .map((step) => ({
      ...step,
      sizes: step.groups.flatMap(
        (slug) => reference.data.sizeGroups.find((g) => g.slug === slug)?.sizes ?? [],
      ),
    }))
    .filter((step) => step.sizes.length > 0);
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;

  const last = index >= steps.length - 1;
  const hasPick = step.sizes.some((s) => sizeIds.includes(s.id));
  const figureHeight = Math.round(Math.min(300, Math.max(190, windowHeight * 0.34)));

  const toggle = (id: string) => {
    if (sizeIds.includes(id)) setTicked(sizeIds.filter((s) => s !== id));
    else if (sizeIds.length < PERSONALISATION_SIZES_MAX) setTicked([...sizeIds, id]);
  };

  const next = () => {
    if (ticked) save.mutate(ticked);
    setTicked(null);
    if (last) onDone();
    else setIndex(index + 1);
  };

  const back = () => {
    if (index > 0) setIndex(index - 1);
    else setWho(null);
  };

  // Nothing to go back to when "What do you shop for?" already told us whose sizes these are.
  const canGoBack = index > 0 || picks.length !== 1;

  return (
    <View className="flex-1">
      <View className="items-center pt-md">
        <BodyFigure kind={FIGURE_KIND[who]} lit={step.lit} height={figureHeight} />
      </View>
      <View className="py-md">
        <Progress current={index} total={steps.length} />
      </View>
      <Animated.View
        key={`${who}-${step.id}`}
        entering={still ? undefined : FadeIn.duration(180)}
        className="flex-1"
      >
        <View className="px-lg">
          <Text variant="heading" accessibilityRole="header">
            {t(`onboarding.sizes.${step.id}.title`)}
          </Text>
          <Text variant="subtitle" className="mb-md mt-xs">
            {t(`onboarding.sizes.${step.id}.hint`)}
          </Text>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-row flex-wrap gap-sm px-lg pb-lg"
          showsVerticalScrollIndicator={false}
        >
          {step.sizes.map((size) => (
            <Chip
              key={size.id}
              label={name(size.name)}
              selected={sizeIds.includes(size.id)}
              onPress={() => toggle(size.id)}
            />
          ))}
        </ScrollView>
      </Animated.View>
      <View className="flex-row gap-md px-lg pb-md">
        {canGoBack && (
          <Button size="lg" variant="ghost" onPress={back}>
            <Text>{t("onboarding.sizes.back")}</Text>
          </Button>
        )}
        <Button size="lg" className="flex-1" variant={hasPick ? "default" : "outline"} onPress={next}>
          <Text>
            {hasPick
              ? last
                ? t("onboarding.finish")
                : t("onboarding.sizes.next")
              : t("onboarding.sizes.skipPart")}
          </Text>
        </Button>
      </View>
    </View>
  );
}
