// Font files loaded through expo-font. Family names match packages/design/fonts.js, which feeds Tailwind.
import { useFonts } from "expo-font";

export function useAppFonts() {
  return useFonts({
    "Aileron-100": require("@vinty/design/fonts/Aileron-100.ttf"),
    "Aileron-300": require("@vinty/design/fonts/Aileron-300.ttf"),
    "Aileron-400": require("@vinty/design/fonts/Aileron-400.ttf"),
    "Aileron-600": require("@vinty/design/fonts/Aileron-600.ttf"),
    "Aileron-700": require("@vinty/design/fonts/Aileron-700.ttf"),
    "Aileron-800": require("@vinty/design/fonts/Aileron-800.ttf"),
    "Heebo-300": require("@vinty/design/fonts/Heebo-300.ttf"),
    "Heebo-400": require("@vinty/design/fonts/Heebo-400.ttf"),
    "Heebo-500": require("@vinty/design/fonts/Heebo-500.ttf"),
    "Heebo-600": require("@vinty/design/fonts/Heebo-600.ttf"),
    "Heebo-700": require("@vinty/design/fonts/Heebo-700.ttf"),
    "Heebo-800": require("@vinty/design/fonts/Heebo-800.ttf"),
  });
}
