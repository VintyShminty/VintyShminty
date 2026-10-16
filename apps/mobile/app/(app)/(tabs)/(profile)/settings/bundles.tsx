import { useQuery } from "@tanstack/react-query";
import {
  BUNDLE_LADDER_MAX_STEPS,
  BUNDLE_MAX_PERCENT,
  BUNDLE_MIN_ITEMS_LIMIT,
  type BundleLadder,
} from "@vinty/shared";
import { Minus, Plus, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SectionHeader, SwitchRow } from "@/components/ui/row";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ownBundleLadderQuery, useSaveBundleLadder } from "@/lib/bundle-queries";
import { cn } from "@/lib/utils";

type Step = { minItems: number; percentOff: number };
/** A step on screen, with an id so the rows keep their place while steps are added or removed. */
type Row = Step & { id: number };

function Stepper({
  label,
  valueText,
  canLess,
  canMore,
  onLess,
  onMore,
  lessLabel,
  moreLabel,
}: {
  label: string;
  valueText: string;
  canLess: boolean;
  canMore: boolean;
  onLess: () => void;
  onMore: () => void;
  lessLabel: string;
  moreLabel: string;
}) {
  const round = "h-9 w-9 items-center justify-center rounded-full border border-border active:bg-pressed";
  return (
    <View className="flex-row items-center justify-between gap-md">
      <Text variant="bodySmall" className="text-text-2">
        {label}
      </Text>
      <View className="flex-row items-center gap-sm">
        <Pressable
          role="button"
          accessibilityLabel={lessLabel}
          disabled={!canLess}
          onPress={onLess}
          className={cn(round, !canLess && "opacity-40")}
        >
          <Icon as={Minus} size={16} />
        </Pressable>
        <Text weight={600} className="min-w-[80px] text-center">
          {valueText}
        </Text>
        <Pressable
          role="button"
          accessibilityLabel={moreLabel}
          disabled={!canMore}
          onPress={onMore}
          className={cn(round, !canMore && "opacity-40")}
        >
          <Icon as={Plus} size={16} />
        </Pressable>
      </View>
    </View>
  );
}

function Editor({ initial }: { initial: BundleLadder }) {
  const { t } = useTranslation();
  const save = useSaveBundleLadder();
  const nextId = useRef(0);
  const withIds = (list: Step[]): Row[] => list.map((s) => ({ ...s, id: nextId.current++ }));
  const [on, setOn] = useState(initial.on);
  const [saved, setSaved] = useState<Step[]>(initial.tiers);
  const [steps, setSteps] = useState<Row[]>(() => withIds(initial.tiers));
  const [done, setDone] = useState(false);

  const send = (next: { on: boolean; tiers: Step[] }) => {
    setDone(false);
    save.mutate(next, {
      onSuccess: (result) => {
        setOn(result.on);
        setSaved(result.tiers);
        setSteps(withIds(result.tiers));
        setDone(true);
      },
    });
  };

  const change = (i: number, patch: Partial<Step>) =>
    setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const last = steps[steps.length - 1];
  const canAdd =
    steps.length < BUNDLE_LADDER_MAX_STEPS &&
    last !== undefined &&
    last.minItems < BUNDLE_MIN_ITEMS_LIMIT &&
    last.percentOff < BUNDLE_MAX_PERCENT;
  const plain = steps.map(({ minItems, percentOff }) => ({ minItems, percentOff }));
  const dirty = JSON.stringify(plain) !== JSON.stringify(saved);

  return (
    <ScreenScroll contentContainerClassName="px-0 pb-2xl">
      {save.isError ? (
        <View className="px-lg pb-md">
          <Banner variant="error">{t("bundleSettings.saveFailed")}</Banner>
        </View>
      ) : null}
      <SwitchRow
        label={t("bundleSettings.offer")}
        description={t("bundleSettings.offerHint")}
        checked={on}
        disabled={save.isPending}
        onCheckedChange={(next) => send({ on: next, tiers: saved })}
        last
      />
      {on ? (
        <>
          <SectionHeader>{t("bundleSettings.steps")}</SectionHeader>
          <Text variant="bodySmall" className="px-lg pb-md text-text-3">
            {t("bundleSettings.stepsNote")}
          </Text>
          <View className="gap-md px-lg">
            {steps.map((step, i) => {
              const prev = steps[i - 1];
              const next = steps[i + 1];
              const minItems = prev ? prev.minItems + 1 : 2;
              const maxItems = next ? next.minItems - 1 : BUNDLE_MIN_ITEMS_LIMIT;
              const minPercent = prev ? prev.percentOff + 1 : 1;
              const maxPercent = next ? next.percentOff - 1 : BUNDLE_MAX_PERCENT;
              return (
                // A step is stacked (title and remove, then items, then discount) so the buttons never touch on a phone.
                <View key={step.id} className="gap-sm rounded-control border border-border-subtle p-md">
                  <View className="flex-row items-center justify-between">
                    <Text weight={600}>{t("bundleSettings.step", { number: i + 1 })}</Text>
                    <Pressable
                      role="button"
                      accessibilityLabel={t("bundleSettings.removeStep", { number: i + 1 })}
                      disabled={steps.length <= 1}
                      onPress={() => setSteps((list) => list.filter((_, j) => j !== i))}
                      className={cn(
                        "h-9 w-9 items-center justify-center rounded-full active:bg-pressed",
                        steps.length <= 1 && "opacity-40",
                      )}
                    >
                      <Icon as={X} size={18} className="text-text-3" />
                    </Pressable>
                  </View>
                  <Stepper
                    label={t("bundleSettings.items")}
                    valueText={t("bundleSettings.itemsValue", { count: step.minItems })}
                    canLess={step.minItems > minItems}
                    canMore={step.minItems < maxItems}
                    onLess={() => change(i, { minItems: step.minItems - 1 })}
                    onMore={() => change(i, { minItems: step.minItems + 1 })}
                    lessLabel={t("bundleSettings.fewer")}
                    moreLabel={t("bundleSettings.more")}
                  />
                  <Stepper
                    label={t("bundleSettings.percent")}
                    valueText={`${step.percentOff}%`}
                    canLess={step.percentOff > minPercent}
                    canMore={step.percentOff < maxPercent}
                    onLess={() => change(i, { percentOff: step.percentOff - 1 })}
                    onMore={() => change(i, { percentOff: step.percentOff + 1 })}
                    lessLabel={t("bundleSettings.fewerOff")}
                    moreLabel={t("bundleSettings.moreOff")}
                  />
                </View>
              );
            })}
          </View>
          <View className="gap-sm px-lg pt-md">
            <Button
              variant="outline"
              disabled={!canAdd}
              onPress={() => {
                if (!last) return;
                setSteps((list) => [
                  ...list,
                  ...withIds([
                    {
                      minItems: last.minItems + 1,
                      percentOff: Math.min(BUNDLE_MAX_PERCENT, last.percentOff + 5),
                    },
                  ]),
                ]);
              }}
            >
              <Icon as={Plus} size={16} className="text-primary" />
              <Text>{t("bundleSettings.addStep")}</Text>
            </Button>
            <Button loading={save.isPending} disabled={!dirty} onPress={() => send({ on, tiers: plain })}>
              <Text>{t("bundleSettings.save")}</Text>
            </Button>
            {done && !dirty ? (
              <Text variant="bodySmall" className="text-center text-success" accessibilityLiveRegion="polite">
                {t("bundleSettings.saved")}
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <Text variant="bodySmall" className="px-lg pt-md text-text-3">
          {t("bundleSettings.off")}
        </Text>
      )}
    </ScreenScroll>
  );
}

/** Settings, Bundles: the switch for offering bundles and the discount steps (D-049). */
export default function BundleSettings() {
  const { t } = useTranslation();
  const ladder = useQuery(ownBundleLadderQuery());
  return (
    <Screen>
      <TopBar title={t("bundleSettings.title")} />
      {ladder.data ? (
        <Editor initial={ladder.data} />
      ) : ladder.isError ? (
        <View className="px-lg pt-lg">
          <Banner variant="error">{t("bundleSettings.loadFailed")}</Banner>
        </View>
      ) : (
        <Spinner />
      )}
    </Screen>
  );
}
