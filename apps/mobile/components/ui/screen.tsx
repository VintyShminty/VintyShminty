import type { ReactNode } from "react";
import { ScrollView, type ScrollViewProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

type ScreenProps = {
  children: ReactNode;
  className?: string;
  /** Leave off for screens inside the tab bar, which already clears the home indicator. */
  bottomInset?: boolean;
};

/** Page container: safe area on top, white background. One scroll owner per screen (docs/components.md, Screen). */
function Screen({ children, className, bottomInset = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={cn("flex-1 bg-background", className)}
      style={{ paddingTop: insets.top, paddingBottom: bottomInset ? insets.bottom : 0 }}
    >
      {children}
    </View>
  );
}

/**
 * Scrolling body for forms. The keyboard pushes the content up instead of covering it,
 * taps on buttons work while the keyboard is open, and dragging down closes the keyboard.
 */
function ScreenScroll({
  children,
  className,
  contentContainerClassName,
  ...props
}: ScrollViewProps & { className?: string; contentContainerClassName?: string }) {
  return (
    <ScrollView
      className={cn("flex-1", className)}
      contentContainerClassName={cn("px-lg pb-xl", contentContainerClassName)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export { Screen, ScreenScroll };
