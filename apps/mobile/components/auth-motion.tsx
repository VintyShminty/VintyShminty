import { Image } from "expo-image";
import { useFocusEffect, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "lucide-react-native";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  Image as NativeImage,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { PhotoFade, useKeyboardOpen, welcomePhoto } from "@/components/auth-photo";
import { Icon } from "@/components/ui/icon";
import { BackIcon } from "@/components/ui/top-bar";

/**
 * Welcome, log in and sign up are one surface (D-026). One number, `progress`, says where we are:
 * 0 is the welcome screen, 1 is a form screen. The photo, the form sheet and the welcome text all read it,
 * so they move together in one smooth motion. Everything animates with transforms and opacity on the
 * UI thread, never layout.
 */
type AuthMotion = {
  progress: SharedValue<number>;
  /** Plays the motion backwards, then leaves the form screen. */
  close: () => void;
  /** True from the moment close starts. The form keeps its layout still while the motion plays. */
  closing: { current: boolean };
};

const AuthMotionContext = createContext<AuthMotion | null>(null);

/** How tall the photo band is under the status bar once the form is up. Same as the forgot password band. */
const BAND = 100;
const BAND_WITH_KEYBOARD = 52;
const SHEET_RADIUS = 22;
/** Where in the photo the band looks, as a share of the hidden part. Same as the forgot password band. */
const BAND_FOCUS = 0.18;

const spring = { duration: 520, dampingRatio: 1, reduceMotion: ReduceMotion.System };

function useAuthMotion(): AuthMotion {
  const value = useContext(AuthMotionContext);
  if (!value) throw new Error("useAuthMotion must be used inside AuthMotionProvider");
  return value;
}

/** Wraps the auth stack. It follows the route: on welcome the photo is full screen, on any form it is the band. */
function AuthMotionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const leaf = segments[segments.length - 1];
  const target = leaf === "log-in" || leaf === "sign-up" || leaf === "forgot-password" ? 1 : 0;
  const progress = useSharedValue(target);
  const closing = useRef(false);

  useEffect(() => {
    if (closing.current) return;
    progress.value = withSpring(target, spring);
  }, [target, progress]);

  const leave = useCallback(() => {
    if (!closing.current) return;
    if (router.canGoBack()) router.dismissAll();
    else router.replace("/");
    // The motion is already at 0 here, so the welcome screen underneath is final and nothing plays again.
    closing.current = false;
  }, [router]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    // The route changes the moment the motion ends, on its own signal, so the sheet is on screen all the way down.
    progress.value = withSpring(0, spring, (finished) => {
      "worklet";
      if (finished) scheduleOnRN(leave);
    });
    // Safety net if the end signal never arrives. leave does nothing the second time.
    setTimeout(leave, spring.duration + 400);
  }, [progress, leave]);

  const value = useMemo(() => ({ progress, close, closing }), [progress, close]);
  return (
    <AuthMotionContext.Provider value={value}>
      <View className="flex-1 bg-pressed">
        <AuthBackdrop />
        {children}
      </View>
    </AuthMotionContext.Provider>
  );
}

/**
 * The photo behind every auth screen. Full screen on welcome, shrinking and sliding up into the band at the
 * top of the form screens. The picture is laid out once at its final size and then scaled, so no frame needs layout.
 */
function AuthBackdrop() {
  const { progress } = useAuthMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const asset = NativeImage.resolveAssetSource(welcomePhoto);
  // The band shows the photo at the screen's width. Scaling that size up by 1 / endScale fills the whole screen.
  const natural = (width * asset.height) / asset.width;
  const endScale = Math.min(1, natural / height);
  const layerWidth = width / endScale;
  const layerHeight = natural / endScale;
  const bandHeight = insets.top + BAND;
  const endShift = -BAND_FOCUS * Math.max(0, natural - bandHeight);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, endShift], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [1, endScale], Extrapolation.CLAMP) },
    ],
  }));
  const welcomeFade = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const bandFade = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <StatusBar style="light" />
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            start: (width - layerWidth) / 2,
            width: layerWidth,
            height: layerHeight,
            transformOrigin: "top",
          },
          photoStyle,
        ]}
      >
        <Image
          source={welcomePhoto}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, welcomeFade]}>
        <PhotoFade
          id="welcome-fade"
          stops={[
            { offset: 0, opacity: 0.45 },
            { offset: 0.22, opacity: 0 },
            { offset: 0.38, opacity: 0 },
            { offset: 0.78, opacity: 0.88 },
            { offset: 1, opacity: 0.92 },
          ]}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bandFade]}>
        <PhotoFade
          id="band-fade"
          stops={[
            { offset: 0, opacity: 0.5 },
            { offset: 0.2, opacity: 0.05 },
            { offset: 1, opacity: 0.05 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

/** Wraps what the welcome screen shows over the photo, so it fades out as the form comes in. */
function WelcomeContent({ children }: { children: ReactNode }) {
  const { progress } = useAuthMotion();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -16], Extrapolation.CLAMP) }],
  }));
  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}

/**
 * The white form sheet of log in and sign up, with the close X over the photo band. It rises from the bottom with
 * the photo. Arriving from the other form (the link at the bottom) it is already up, so it just fades in place.
 */
function AuthSheet({ children, back = false }: { children: ReactNode; back?: boolean }) {
  const { progress, close, closing } = useAuthMotion();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboardNow = useKeyboardOpen();
  // Closing hides the keyboard. The photo band must not grow while the sheet slides down, so it keeps its size.
  const keyboardOpenRef = useRef(keyboardNow);
  if (!closing.current) keyboardOpenRef.current = keyboardNow;
  const keyboardOpen = keyboardOpenRef.current;
  const fade = useSharedValue(progress.value > 0.99 ? 0 : 1);

  useEffect(() => {
    if (fade.value < 1) fade.value = withTiming(1, { duration: 200, reduceMotion: ReduceMotion.System });
  }, [fade]);

  // The screen underneath stays on screen (the screens are see-through), so it fades out while another sheet covers it.
  const shown = useSharedValue(1);
  useFocusEffect(
    useCallback(() => {
      shown.value = withTiming(1, { duration: 200, reduceMotion: ReduceMotion.System });
      return () => {
        shown.value = withTiming(0, { duration: 200, reduceMotion: ReduceMotion.System });
      };
    }, [shown]),
  );

  const style = useAnimatedStyle(() => ({
    opacity: fade.value * shown.value,
    transform: [{ translateY: (1 - progress.value) * height }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <View style={{ height: insets.top + (keyboardOpen ? BAND_WITH_KEYBOARD : BAND) }}>
        <View style={{ paddingTop: insets.top }} className="h-full px-md">
          <View className="h-12 items-start justify-center">
            <Pressable
              onPress={back ? () => router.back() : close}
              hitSlop={8}
              role="button"
              accessibilityLabel={back ? t("common.back") : t("common.close")}
              className="h-9 w-9 items-center justify-center rounded-full bg-background/95 active:bg-background"
            >
              {back ? <BackIcon /> : <Icon as={X} size={24} />}
            </Pressable>
          </View>
        </View>
      </View>
      <View
        className="flex-1 bg-background"
        style={{
          borderTopStartRadius: SHEET_RADIUS,
          borderTopEndRadius: SHEET_RADIUS,
          paddingBottom: insets.bottom,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export { AuthMotionProvider, AuthSheet, WelcomeContent };
