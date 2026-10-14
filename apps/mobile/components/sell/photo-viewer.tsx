import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Modal, Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useIsRtl } from "@/lib/rtl";
import { colors } from "@/theme";

const MAX_ZOOM = 4;
const DISMISS_DISTANCE = 110;
const SPRING = { damping: 28, stiffness: 320, mass: 1 };

type ViewerPhoto = { id: string; uri: string };

/** One full-screen photo. Pinch to zoom, drag when zoomed, double tap to zoom, drag down to close. */
function ViewerPage({
  uri,
  width,
  height,
  zoomed,
  onZoomed,
  onDismissDrag,
  onDismiss,
}: {
  uri: string;
  width: number;
  height: number;
  zoomed: boolean;
  onZoomed: (zoomed: boolean) => void;
  onDismissDrag: (progress: number) => void;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dragY = useSharedValue(0);

  const settle = (value: number) => {
    "worklet";
    return reduced ? withTiming(value, { duration: 0 }) : withSpring(value, SPRING);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = settle(1);
        x.value = settle(0);
        y.value = settle(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
        runOnJS(onZoomed)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(onZoomed)(true);
      }
    });

  // One finger moves the photo around while it is zoomed in.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .maxPointers(2)
    .onUpdate((e) => {
      if (savedScale.value <= 1) return;
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      x.value = Math.min(maxX, Math.max(-maxX, savedX.value + e.translationX));
      y.value = Math.min(maxY, Math.max(-maxY, savedY.value + e.translationY));
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  // At normal size, a downward drag pulls the photo away and closes the viewer.
  const dismiss = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .enabled(!zoomed)
    .maxPointers(1)
    .onUpdate((e) => {
      if (savedScale.value > 1) return;
      dragY.value = Math.max(0, e.translationY);
      runOnJS(onDismissDrag)(Math.min(1, dragY.value / (height / 2)));
    })
    .onEnd((e) => {
      if (savedScale.value > 1) return;
      if (dragY.value > DISMISS_DISTANCE || e.velocityY > 900) {
        runOnJS(onDismiss)();
      } else {
        dragY.value = settle(0);
        runOnJS(onDismissDrag)(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = savedScale.value <= 1;
      const next = zoomIn ? 2.5 : 1;
      scale.value = settle(next);
      x.value = settle(0);
      y.value = settle(0);
      savedScale.value = next;
      savedX.value = 0;
      savedY.value = 0;
      runOnJS(onZoomed)(zoomIn);
    });

  const gesture = Gesture.Simultaneous(pinch, pan, dismiss, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + dragY.value },
      { scale: scale.value * (1 - Math.min(0.15, dragY.value / 2000)) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height, alignItems: "center", justifyContent: "center" }, style]}>
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Full-screen look at the listing's photos. Swipe between them, pinch to zoom, drag down or tap the cross to close.
 * It is a plain modal with its own gesture root, so it works above the sell form's native modal.
 */
function PhotoViewer({
  photos,
  startIndex,
  onClose,
}: {
  photos: readonly ViewerPhoto[];
  /** Null keeps the viewer closed. */
  startIndex: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rtl = useIsRtl();
  const reduced = useReducedMotion();
  const [zoomed, setZoomed] = useState(false);
  const [current, setCurrent] = useState(0);
  const backdrop = useSharedValue(1);
  const list = useRef<FlatList<ViewerPhoto>>(null);

  // The list always runs left to right. In Hebrew it is reversed, so the first photo sits on the right and
  // swiping towards the left shows the next one.
  const data = rtl ? [...photos].reverse() : [...photos];
  const toListIndex = (index: number) => (rtl ? photos.length - 1 - index : index);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const close = useCallback(() => {
    setZoomed(false);
    backdrop.value = 1;
    onClose();
  }, [backdrop, onClose]);

  if (startIndex === null) return null;
  const startList = toListIndex(startIndex);

  return (
    <Modal
      visible
      transparent
      animationType={reduced ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={close}
      onShow={() => setCurrent(startIndex)}
    >
      <GestureHandlerRootView style={{ flex: 1, direction: "ltr" }}>
        <Animated.View
          style={[
            { position: "absolute", top: 0, bottom: 0, start: 0, end: 0, backgroundColor: colors.text1 },
            backdropStyle,
          ]}
        />
        <FlatList
          ref={list}
          data={data}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          extraData={zoomed}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => p.id}
          initialScrollIndex={startList}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(e) => {
            const listIndex = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrent(rtl ? photos.length - 1 - listIndex : listIndex);
          }}
          renderItem={({ item }) => (
            <ViewerPage
              uri={item.uri}
              width={width}
              height={height}
              zoomed={zoomed}
              onZoomed={setZoomed}
              onDismissDrag={(progress) => {
                backdrop.value = 1 - progress * 0.8;
              }}
              onDismiss={close}
            />
          )}
        />
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: insets.top + 8,
            start: 16,
            end: 16,
            direction: rtl ? "rtl" : "ltr",
          }}
          className="flex-row items-center justify-between"
        >
          <View className="rounded-full bg-window px-md py-xs">
            <Text variant="badge" weight={700}>
              {t("sell.photos.tileLabel", { n: current + 1, total: photos.length })}
            </Text>
          </View>
          <Pressable
            onPress={close}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("sell.photos.viewerClose")}
            className="h-10 w-10 items-center justify-center rounded-full bg-window active:bg-pressed"
          >
            <Icon as={X} size={20} />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export { PhotoViewer };
