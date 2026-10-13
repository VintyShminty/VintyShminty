import { useQuery } from "@tanstack/react-query";
import { type OnboardingPick, PERSONALISATION_SIZES_MAX } from "@vinty/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { SizeFigureView } from "@/components/onboarding/size-figure";
import { SIZE_STEPS, type SizeFigure } from "@/components/onboarding/size-steps";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { personalisationSizesQuery, useSavePersonalisationSizes } from "@/lib/item-queries";
import { useLocalName, useReference } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

const FIGURES: SizeFigure[] = ["women", "men", "kids"];

/** The small row of dots at the end of the title row, the current one is longer and espresso. */
function Progress({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const dots = Array.from({ length: total }, (_, i) => i);
  return (
    <View
      className="h-2 flex-row items-center gap-xs"
      accessibilityRole="progressbar"
      accessibilityLabel={t("onboarding.sizes.progress", { current: current + 1, total })}
    >
      {dots.map((dot) => (
        <View
          key={dot}
          className={cn("h-2 rounded-full", dot === current ? "w-5 bg-primary" : "w-2 bg-border")}
        />
      ))}
    </View>
  );
}

/**
 * The sizes question of the sign up flow (D-029). One ink drawing per step, with the part you are choosing for in colour
 * and the rest faded, while you pick the sizes that belong to that part. With more than one pick in "What do you shop for?" it first asks whose sizes.
 * The sizes are saved the same way as in Settings (My sizes), after each part.
 */
export function SizesStep({ picks, onDone }: { picks: OnboardingPick[]; onDone: () => void }) {
  const { t } = useTranslation();
  const name = useLocalName();
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
      rows: step.groups
        .map((group) => ({
          label: group.label,
          sizes: reference.data.sizeGroups.find((g) => g.slug === group.slug)?.sizes ?? [],
        }))
        .filter((row) => row.sizes.length > 0),
    }))
    .filter((step) => step.rows.length > 0);
  const stepIndex = Math.min(index, steps.length - 1);
  const step = steps[stepIndex];
  if (!step) return null;

  const last = stepIndex >= steps.length - 1;
  const following = steps[stepIndex + 1];
  const hasPick = step.rows.some((row) => row.sizes.some((s) => sizeIds.includes(s.id)));

  const toggle = (id: string) => {
    if (sizeIds.includes(id)) setTicked(sizeIds.filter((s) => s !== id));
    else if (sizeIds.length < PERSONALISATION_SIZES_MAX) setTicked([...sizeIds, id]);
  };

  const next = () => {
    if (ticked) save.mutate(ticked);
    setTicked(null);
    if (last) onDone();
    else setIndex(stepIndex + 1);
  };

  const back = () => {
    if (index > 0) setIndex(index - 1);
    else setWho(null);
  };

  // Nothing to go back to when "What do you shop for?" already told us whose sizes these are.
  const canGoBack = index > 0 || picks.length !== 1;

  const mainLabel = !hasPick
    ? t("onboarding.sizes.skipPart")
    : following
      ? t("onboarding.sizes.nextTo", { step: t(`onboarding.sizes.${following.id}.title`) })
      : t("onboarding.finish");

  return (
    <View className="flex-1">
      <View className="flex-1 px-lg pt-sm">
        <SizeFigureView figure={who} steps={steps} active={step.id} />
      </View>
      <View
        className="rounded-t-window border-t border-border-subtle bg-background px-lg pb-md pt-lg"
        style={{
          shadowColor: colors.text1,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -6 },
        }}
      >
        <View className="flex-row items-start justify-between gap-md">
          <Text variant="title" className="flex-1" accessibilityRole="header">
            {t(`onboarding.sizes.${step.id}.title`)}
          </Text>
          <View className="pt-md">
            <Progress current={stepIndex} total={steps.length} />
          </View>
        </View>
        <Text variant="subtitle" className="mb-xs mt-xs">
          {t(`onboarding.sizes.${step.id}.hint`)}
        </Text>
        <ScrollView
          style={{ maxHeight: Math.round(windowHeight * 0.36) }}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-md"
        >
          {step.rows.map((row) => (
            <View key={row.label ?? "all"}>
              {row.label && (
                <Text variant="sectionLabel" className="mb-sm mt-md text-text-3">
                  {t(`onboarding.sizes.${row.label}`)}
                </Text>
              )}
              <View className={cn("flex-row flex-wrap gap-sm", !row.label && "mt-md")}>
                {row.sizes.map((size) => (
                  <Chip
                    key={size.id}
                    label={name(size.name)}
                    selected={sizeIds.includes(size.id)}
                    onPress={() => toggle(size.id)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <Button size="lg" variant={hasPick ? "default" : "outline"} onPress={next}>
          <Text>{mainLabel}</Text>
        </Button>
        {canGoBack && (
          <Button size="lg" variant="ghost" className="mt-xs" onPress={back}>
            <Text>{t("onboarding.sizes.back")}</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
