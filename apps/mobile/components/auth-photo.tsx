import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, LayoutAnimation, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Icon } from "@/components/ui/icon";
import { BackIcon } from "@/components/ui/top-bar";
import { colors } from "@/theme";

/** The bundled sample photo (Unsplash, credit in assets/images/CREDITS.md). A real brand photo replaces it before launch (D-021). */
const welcomePhoto = require("../assets/images/welcome-photo.jpg");

type FadeStop = { offset: number; opacity: number };

/** A dark fade over a photo. The colour is the text-1 token, so no hex lives here. */
function PhotoFade({ id, stops }: { id: string; stops: FadeStop[] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={colors.text1} stopOpacity={s.opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Full screen photo with the dark fade of the welcome screen (D-021). */
function WelcomePhoto() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={welcomePhoto}
        contentFit="cover"
        contentPosition={{ top: "12%", left: "50%" }}
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
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
    </View>
  );
}

/** True while the keyboard is up. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOpen(true);
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOpen(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * The photo band at the top of log in, sign up and forgot password, with the back button over it (D-021).
 * It shrinks to just the back button while the keyboard is open, so the field and the button always stay in view.
 * Log in and sign up slide up from the bottom (D-026), so there the button is a close X, not a back arrow.
 */
function AuthPhotoBand({ close = false }: { close?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const keyboardOpen = useKeyboardOpen();
  return (
    <View
      className="overflow-hidden bg-pressed"
      style={{
        height: insets.top + (keyboardOpen ? 52 : 100),
        borderBottomStartRadius: 22,
        borderBottomEndRadius: 22,
      }}
    >
      <StatusBar style="light" />
      <Image
        source={welcomePhoto}
        contentFit="cover"
        contentPosition={{ top: "18%", left: "50%" }}
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      <PhotoFade
        id="band-fade"
        stops={[
          { offset: 0, opacity: 0.5 },
          { offset: 1, opacity: 0.05 },
        ]}
      />
      <View style={{ paddingTop: insets.top }} className="h-full px-md">
        <View className="h-12 items-start justify-center">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={8}
            role="button"
            accessibilityLabel={close ? t("common.close") : t("common.back")}
            className="h-9 w-9 items-center justify-center rounded-full bg-background/95 active:bg-background"
          >
            {close ? <Icon as={X} size={24} /> : <BackIcon />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export { AuthPhotoBand, WelcomePhoto };
