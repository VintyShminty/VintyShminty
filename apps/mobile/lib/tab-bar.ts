import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The floating tab bar (D-019): 64 points tall, 16 points from each side. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_SIDE_GAP = 16;
/** Air between the bar and the content above it. */
const CONTENT_GAP = 12;

/** True while the keyboard is open. The bar hides itself then. */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * How far the bar floats above the bottom edge. On iPhone it dips a little into the home indicator area, never
 * touching it. Android draws its gesture line in the middle of that area, so there the bar sits fully above it.
 */
export function tabBarBottomGap(safeBottom: number) {
  if (Platform.OS === "android") return safeBottom + 8;
  return safeBottom > 0 ? Math.max(safeBottom - 10, 12) : 12;
}

/**
 * The space a screen inside a tab must leave at its bottom so the last row is never under the bar.
 * Read the real safe area (above the tab stack). Zero while the keyboard is open, because the bar is hidden then.
 */
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  if (keyboard) return 0;
  return tabBarBottomGap(insets.bottom) + TAB_BAR_HEIGHT + CONTENT_GAP;
}
