import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

function Dot({ index, still }: { index: number; still: boolean }) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    if (still) return;
    opacity.set(
      withDelay(
        index * 160,
        withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.35, { duration: 360 })), -1),
      ),
    );
    return () => cancelAnimation(opacity);
  }, [index, still, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View className="h-2 w-2 rounded-full bg-text-3" style={style} />;
}

/** Three quiet dots in a bubble: the other person is typing. Still (no motion) when the phone asks for less motion. */
function TypingIndicator({ name }: { name: string }) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  return (
    <View className="px-lg pt-md">
      <View
        className="flex-row items-center gap-xs self-start rounded-window border border-border-subtle bg-background px-md py-md"
        style={{ borderEndStartRadius: 6 }}
        accessibilityLabel={t("chat.typing", { name })}
        accessibilityLiveRegion="polite"
      >
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} still={still} />
        ))}
      </View>
    </View>
  );
}

export { TypingIndicator };
