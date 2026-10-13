import { Image } from "expo-image";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FIGURE_FILE, type SizeFigure, type SizeStep } from "@/components/onboarding/size-steps";

// Hand-drawn ink pictures (D-029). All pictures of one person have the same crop and size, so the figure never jumps.
const PICTURES = {
  "woman-tops": require("@/assets/sizes/woman-tops.jpg"),
  "woman-bottoms": require("@/assets/sizes/woman-bottoms.jpg"),
  "woman-belts": require("@/assets/sizes/woman-belts.jpg"),
  "woman-shoes": require("@/assets/sizes/woman-shoes.jpg"),
  "man-tops": require("@/assets/sizes/man-tops.jpg"),
  "man-bottoms": require("@/assets/sizes/man-bottoms.jpg"),
  "man-belts": require("@/assets/sizes/man-belts.jpg"),
  "man-shoes": require("@/assets/sizes/man-shoes.jpg"),
  "kid-whole": require("@/assets/sizes/kid-whole.jpg"),
  "kid-shoes": require("@/assets/sizes/kid-shoes.jpg"),
} as const;

type PictureKey = keyof typeof PICTURES;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const FADE_MS = 300;

/** One picture, stacked on the others. Only its opacity changes, which runs on the UI thread. */
function Layer({ source, on }: { source: number; on: boolean }) {
  const still = useReducedMotion();
  const opacity = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    opacity.set(still ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: FADE_MS, easing: EASE_OUT }));
  }, [on, still, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View className="absolute inset-0" style={style} pointerEvents="none">
      <Image source={source} contentFit="contain" style={{ width: "100%", height: "100%" }} />
    </Animated.View>
  );
}

/**
 * The ink drawing of one person for the sizes step. Every step of that person is rendered stacked and the active one
 * fades in while the old one fades out. It is decoration, so screen readers skip it.
 */
export function SizeFigureView({
  figure,
  steps,
  active,
}: {
  figure: SizeFigure;
  steps: Pick<SizeStep, "id" | "picture">[];
  active: SizeStep["id"];
}) {
  const file = FIGURE_FILE[figure];
  return (
    <View
      className="flex-1 self-stretch"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {steps.map((step) => (
        <Layer
          key={step.id}
          source={PICTURES[`${file}-${step.picture}` as PictureKey]}
          on={step.id === active}
        />
      ))}
    </View>
  );
}
