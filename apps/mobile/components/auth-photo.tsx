import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "@/theme";

/** The photo and its dark fades, shared by welcome, log in, sign up and forgot password (see auth-motion.tsx). The bundled sample photo (Unsplash, credit in assets/images/CREDITS.md). A real brand photo replaces it before launch (D-021). */
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

export { PhotoFade, useKeyboardOpen, welcomePhoto };
