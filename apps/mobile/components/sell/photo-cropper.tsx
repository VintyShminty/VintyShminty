import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { CropRect } from "@/lib/listing-photos";
import { colors } from "@/theme";

/** The smallest the crop box can get, in points. */
const MIN_BOX = 64;
/** Touch size of a corner handle and the size of the visible corner mark. */
const HIT = 44;
const MARK = 22;
const MARK_WIDTH = 3;
/** How much of the photo the box covers when the crop screen opens. */
const START_INSET = 0.06;

type Box = { x: SharedValue<number>; y: SharedValue<number>; w: SharedValue<number>; h: SharedValue<number> };

const clamp = (value: number, low: number, high: number) => {
  "worklet";
  return Math.min(Math.max(value, low), high);
};

/** One draggable corner. It moves its two edges and keeps the box inside the photo and above the minimum size. */
function Handle({
  fx,
  fy,
  box,
  dw,
  dh,
  min,
}: {
  fx: 0 | 1;
  fy: 0 | 1;
  box: Box;
  dw: number;
  dh: number;
  min: number;
}) {
  const start = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });
  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = { x: box.x.value, y: box.y.value, w: box.w.value, h: box.h.value };
    })
    .onUpdate((e) => {
      const s = start.value;
      let left = s.x;
      let right = s.x + s.w;
      let top = s.y;
      let bottom = s.y + s.h;
      if (fx === 0) left = clamp(s.x + e.translationX, 0, right - min);
      else right = clamp(right + e.translationX, left + min, dw);
      if (fy === 0) top = clamp(s.y + e.translationY, 0, bottom - min);
      else bottom = clamp(bottom + e.translationY, top + min, dh);
      box.x.value = left;
      box.y.value = top;
      box.w.value = right - left;
      box.h.value = bottom - top;
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: box.x.value + (fx === 1 ? box.w.value : 0) - HIT / 2 },
      { translateY: box.y.value + (fy === 1 ? box.h.value : 0) - HIT / 2 },
    ],
  }));
  const inward = (HIT - MARK) / 2 - MARK_WIDTH / 2;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          { position: "absolute", top: 0, start: 0, width: HIT, height: HIT },
          { alignItems: "center", justifyContent: "center" },
          style,
        ]}
      >
        <View
          style={{
            width: MARK,
            height: MARK,
            borderColor: colors.background,
            borderTopWidth: fy === 0 ? MARK_WIDTH : 0,
            borderBottomWidth: fy === 1 ? MARK_WIDTH : 0,
            borderLeftWidth: fx === 0 ? MARK_WIDTH : 0,
            borderRightWidth: fx === 1 ? MARK_WIDTH : 0,
            transform: [
              { translateX: fx === 0 ? -inward : inward },
              { translateY: fy === 0 ? -inward : inward },
            ],
          }}
        />
      </Animated.View>
    </GestureDetector>
  );
}

/** The photo's own area: dimmed outside the box, a moveable box and four corner handles. Positions are in points. */
function CropBox({ box, dw, dh }: { box: Box; dw: number; dh: number }) {
  const min = Math.min(MIN_BOX, dw, dh);
  const start = useSharedValue({ x: 0, y: 0 });
  const move = Gesture.Pan()
    .onBegin(() => {
      start.value = { x: box.x.value, y: box.y.value };
    })
    .onUpdate((e) => {
      box.x.value = clamp(start.value.x + e.translationX, 0, dw - box.w.value);
      box.y.value = clamp(start.value.y + e.translationY, 0, dh - box.h.value);
    });

  const bodyStyle = useAnimatedStyle(() => ({
    width: box.w.value,
    height: box.h.value,
    transform: [{ translateX: box.x.value }, { translateY: box.y.value }],
  }));
  const topDim = useAnimatedStyle(() => ({ width: dw, height: box.y.value }));
  const bottomDim = useAnimatedStyle(() => ({
    width: dw,
    height: Math.max(0, dh - box.y.value - box.h.value),
    transform: [{ translateY: box.y.value + box.h.value }],
  }));
  const leftDim = useAnimatedStyle(() => ({
    width: box.x.value,
    height: box.h.value,
    transform: [{ translateY: box.y.value }],
  }));
  const rightDim = useAnimatedStyle(() => ({
    width: Math.max(0, dw - box.x.value - box.w.value),
    height: box.h.value,
    transform: [{ translateX: box.x.value + box.w.value }, { translateY: box.y.value }],
  }));
  const dim = {
    position: "absolute",
    top: 0,
    start: 0,
    backgroundColor: colors.text1,
    opacity: 0.6,
  } as const;

  return (
    <View style={{ width: dw, height: dh }}>
      <Animated.View pointerEvents="none" style={[dim, topDim]} />
      <Animated.View pointerEvents="none" style={[dim, bottomDim]} />
      <Animated.View pointerEvents="none" style={[dim, leftDim]} />
      <Animated.View pointerEvents="none" style={[dim, rightDim]} />
      <GestureDetector gesture={move}>
        <Animated.View
          style={[
            { position: "absolute", top: 0, start: 0, borderWidth: 1, borderColor: colors.background },
            bodyStyle,
          ]}
        />
      </GestureDetector>
      <Handle fx={0} fy={0} box={box} dw={dw} dh={dh} min={min} />
      <Handle fx={1} fy={0} box={box} dw={dw} dh={dh} min={min} />
      <Handle fx={0} fy={1} box={box} dw={dw} dh={dh} min={min} />
      <Handle fx={1} fy={1} box={box} dw={dw} dh={dh} min={min} />
    </View>
  );
}

/**
 * Our own crop screen, drawn over the full-screen viewer. Drag a corner to resize the box (any shape), drag inside it to
 * move it. Done hands back the box as fractions (0 to 1) of the photo plus the photo's real pixel size, so the caller
 * can crop on the phone or ask the server. The photo is shown contain-fitted, so the box is mapped from the picture's
 * own rectangle and not from the whole stage.
 */
function PhotoCropper({
  uri,
  busy,
  onCancel,
  onDone,
}: {
  uri: string;
  busy: boolean;
  onCancel: () => void;
  onDone: (rect: CropRect, size: { width: number; height: number }) => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stageTop = insets.top + 24;
  const stageHeight = height - stageTop - insets.bottom - 96;
  const stageWidth = width - 32;
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const box: Box = { x: useSharedValue(0), y: useSharedValue(0), w: useSharedValue(0), h: useSharedValue(0) };

  const fit = natural ? Math.min(stageWidth / natural.width, stageHeight / natural.height) : 1;
  const dw = natural ? natural.width * fit : 0;
  const dh = natural ? natural.height * fit : 0;

  const done = () => {
    if (!natural || dw === 0 || dh === 0) return;
    onDone(
      {
        x: box.x.value / dw,
        y: box.y.value / dh,
        width: box.w.value / dw,
        height: box.h.value / dh,
      },
      natural,
    );
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        start: 0,
        end: 0,
        backgroundColor: colors.text1,
        direction: "ltr",
      }}
    >
      <View
        accessibilityLabel={t("sell.photos.cropArea")}
        style={{
          position: "absolute",
          top: stageTop,
          start: 16,
          width: stageWidth,
          height: stageHeight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* The picture is measured first, then the box is drawn on exactly the picture's rectangle. */}
        <Image
          source={{ uri }}
          style={natural ? { width: dw, height: dh } : { width: stageWidth, height: stageHeight }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          onLoad={(e) => {
            const { width: w, height: h } = e.source;
            if (!w || !h) return;
            const f = Math.min(stageWidth / w, stageHeight / h);
            const pw = w * f;
            const ph = h * f;
            box.x.value = pw * START_INSET;
            box.y.value = ph * START_INSET;
            box.w.value = pw * (1 - 2 * START_INSET);
            box.h.value = ph * (1 - 2 * START_INSET);
            setNatural({ width: w, height: h });
          }}
        />
        {natural ? (
          <View
            style={{
              position: "absolute",
              top: (stageHeight - dh) / 2,
              start: (stageWidth - dw) / 2,
            }}
          >
            <CropBox box={box} dw={dw} dh={dh} />
          </View>
        ) : null}
      </View>
      <View
        style={{ position: "absolute", bottom: insets.bottom + 16, start: 16, end: 16 }}
        className="flex-row gap-md"
      >
        <Button variant="secondary" className="flex-1" disabled={busy} onPress={onCancel}>
          <Text>{t("common.cancel")}</Text>
        </Button>
        <Button className="flex-1" loading={busy} disabled={!natural} onPress={done}>
          <Text>{t("common.done")}</Text>
        </Button>
      </View>
    </View>
  );
}

export { PhotoCropper };
