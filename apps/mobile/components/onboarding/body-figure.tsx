import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import {
  type BodyRegion,
  FIGURES,
  type FigureKind,
  type Highlight,
  LIT,
} from "@/components/onboarding/body-paths";
import { colors } from "@/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const LINE_WIDTH = 1.5;
const LIT_WIDTH = 1.9;
const QUIET = 0.55;
const FILL = 0.16;

/** One part of the body. Its espresso outline and soft fill fade in and out when it becomes the active part. */
function Glow({ d, on }: { d: string; on: boolean }) {
  const still = useReducedMotion();
  const amount = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    amount.set(still ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 260, easing: EASE_OUT }));
  }, [on, still, amount]);

  const props = useAnimatedProps(() => ({
    fillOpacity: amount.get() * FILL,
    strokeOpacity: amount.get(),
  }));

  return (
    <AnimatedPath
      d={d}
      animatedProps={props}
      fill={colors.accent}
      stroke={colors.accent}
      strokeWidth={LIT_WIDTH}
      strokeLinejoin="round"
    />
  );
}

/**
 * A faceless line drawing of a body (D-026). Everything is drawn in a quiet line colour, and the parts named in
 * `lit` glow in espresso. It is decoration, so screen readers skip it.
 */
export function BodyFigure({ kind, lit, height }: { kind: FigureKind; lit: Highlight; height: number }) {
  const shape = FIGURES[kind];
  const width = (height * shape.viewBox.width) / shape.viewBox.height;
  const active = LIT[lit];
  const regions = Object.entries(shape.regions) as [BodyRegion, string][];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${shape.viewBox.width} ${shape.viewBox.height}`}>
        <Path
          d={shape.head}
          fill="none"
          stroke={colors.text4}
          strokeOpacity={QUIET}
          strokeWidth={LINE_WIDTH}
          strokeLinejoin="round"
        />
        {regions.map(([region, d]) => (
          <Path
            key={region}
            d={d}
            fill="none"
            stroke={colors.text4}
            strokeOpacity={QUIET}
            strokeWidth={LINE_WIDTH}
            strokeLinejoin="round"
          />
        ))}
        {regions.map(([region, d]) => (
          <Glow key={region} d={d} on={active.includes(region)} />
        ))}
      </Svg>
    </View>
  );
}
