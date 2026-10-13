import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useIsRtl } from "@/lib/rtl";
import { cn } from "@/lib/utils";

/** Arrow that points back: left in left-to-right languages, right in right-to-left ones. */
function BackIcon({ className }: { className?: string }) {
  const rtl = useIsRtl();
  return <Icon as={rtl ? ChevronRight : ChevronLeft} size={24} className={className} />;
}

/** Arrow that points forward (rows that open another screen). */
function ForwardIcon({ className }: { className?: string }) {
  const rtl = useIsRtl();
  return <Icon as={rtl ? ChevronLeft : ChevronRight} size={20} className={className ?? "text-text-4"} />;
}

type TopBarProps = {
  title?: string;
  /** "back" shows the back arrow, "close" shows an X, "none" leaves the space empty. */
  leading?: "back" | "close" | "none";
  onBack?: () => void;
  trailing?: ReactNode;
  /** Gives both sides room for a text action such as "Clear all", so the title stays centred. */
  wideSides?: boolean;
  className?: string;
};

/** Top bar for pushed screens: back arrow, centred title, optional action at the end (docs/design.md, Navigation). */
function TopBar({ title, leading = "back", onBack, trailing, wideSides, className }: TopBarProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")));
  return (
    <View className={cn("h-14 flex-row items-center px-sm", className)}>
      <View className={cn("items-start", wideSides ? "w-24" : "w-12")}>
        {leading === "none" ? null : (
          <Pressable
            onPress={goBack}
            hitSlop={8}
            role="button"
            accessibilityLabel={leading === "close" ? t("common.close") : t("common.back")}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
          >
            {leading === "close" ? <Icon as={X} size={24} /> : <BackIcon />}
          </Pressable>
        )}
      </View>
      <View className="flex-1 items-center">
        {title ? (
          <Text variant="heading" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>
      <View className={cn("items-end", wideSides ? "w-24 pe-sm" : "w-12")}>{trailing}</View>
    </View>
  );
}

export { BackIcon, ForwardIcon, TopBar };
