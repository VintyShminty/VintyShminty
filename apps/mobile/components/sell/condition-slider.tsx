import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { type AccessibilityActionEvent, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Text } from "@/components/ui/text";
import { useIsRtl } from "@/lib/rtl";
import { cn } from "@/lib/utils";

export type ConditionStop = { id: string; label: string; description?: string };

/** One stop on the track. The chosen one grows with a spring (no growing when the phone asks for less motion). */
function Stop({ reached, chosen, still }: { reached: boolean; chosen: boolean; still: boolean }) {
  const scale = useSharedValue(chosen ? 1.55 : 1);
  scale.set(
    still
      ? chosen
        ? 1.55
        : 1
      : withSpring(chosen ? 1.55 : 1, {
          duration: 280,
          dampingRatio: 0.7,
          reduceMotion: ReduceMotion.System,
        }),
  );
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View
      style={style}
      className={cn(
        "h-4 w-4 rounded-full border-2",
        reached ? "border-primary bg-primary" : "border-border bg-background",
      )}
    />
  );
}

/**
 * The condition slider (D-019, row 10): five stops from Unworn with tags to Well loved, a name under each stop and
 * the chosen level's hint below. Drag, tap a stop, or use VoiceOver's adjustable swipe up and down. The first stop
 * sits at the start side, so in Hebrew the track runs right to left like the rest of the screen.
 */
function ConditionSlider({
  stops,
  value,
  onChange,
  error,
}: {
  stops: ConditionStop[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const rtl = useIsRtl();
  const still = useReducedMotion();
  const count = stops.length;
  const index = stops.findIndex((s) => s.id === value);
  const chosen = index >= 0 ? stops[index] : null;
  const width = useSharedValue(0);
  const last = useSharedValue(index);
  last.set(index);

  const pick = useCallback((i: number) => onChange(stops[i]?.id ?? ""), [onChange, stops]);

  const toIndex = (x: number) => {
    "worklet";
    const w = width.get();
    if (w <= 0) return 0;
    const fromStart = rtl ? w - x : x;
    return Math.max(0, Math.min(count - 1, Math.floor((fromStart / w) * count)));
  };

  const drag = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const i = toIndex(e.x);
      if (i !== last.get()) {
        last.set(i);
        scheduleOnRN(pick, i);
      }
    });
  const tap = Gesture.Tap().onEnd((e) => {
    const i = toIndex(e.x);
    if (i !== last.get()) {
      last.set(i);
      scheduleOnRN(pick, i);
    }
  });
  const gesture = Gesture.Race(drag, tap);

  const step = (delta: number) => {
    const next = Math.max(
      0,
      Math.min(count - 1, (index < 0 ? Math.floor(count / 2) - delta : index) + delta),
    );
    pick(next);
  };
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === "increment") step(1);
    if (e.nativeEvent.actionName === "decrement") step(-1);
  };

  return (
    <View className="gap-sm">
      <GestureHandlerRootView>
        <GestureDetector gesture={gesture}>
          <View
            onLayout={(e) => width.set(e.nativeEvent.layout.width)}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t("sell.condition")}
            accessibilityHint={t("sell.conditionAdjustHint")}
            accessibilityValue={{
              text: chosen
                ? t("sell.conditionStop", { name: chosen.label, n: index + 1, total: count })
                : t("sell.conditionPick"),
            }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={onAction}
          >
            <View className="h-10 justify-center">
              <View
                className="absolute h-[2px] bg-border"
                style={{ start: `${50 / count}%`, end: `${50 / count}%` }}
              />
              {index > 0 ? (
                <View
                  className="absolute h-[2px] bg-primary"
                  style={{ start: `${50 / count}%`, width: `${(index * 100) / count}%` }}
                />
              ) : null}
              <View className="flex-row">
                {stops.map((s, i) => (
                  <View key={s.id} className="flex-1 items-center">
                    <Stop reached={i <= index} chosen={i === index} still={still} />
                  </View>
                ))}
              </View>
            </View>
            <View className="flex-row" importantForAccessibility="no-hide-descendants">
              {stops.map((s, i) => (
                <View key={s.id} className="flex-1 items-center px-px">
                  <Text
                    variant="cardMeta"
                    weight={i === index ? 700 : 400}
                    className={cn("text-center", i === index ? "text-primary" : "text-text-3")}
                    numberOfLines={3}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
      <View className="gap-xs rounded-control bg-surface p-md" accessibilityLiveRegion="polite">
        <Text weight={600}>{chosen ? chosen.label : t("sell.conditionPick")}</Text>
        {chosen?.description ? (
          <Text variant="bodySmall" className="text-text-3">
            {chosen.description}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="cardDesc" className="text-error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export { ConditionSlider };
