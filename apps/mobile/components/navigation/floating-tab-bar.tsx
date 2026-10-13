import type { Tabs } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { House, LayoutGrid, MessageCircle, Tag, User } from "lucide-react-native";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TAB_BAR_HEIGHT, TAB_BAR_SIDE_GAP, tabBarBottomGap, useKeyboardVisible } from "@/lib/tab-bar";
import { colors } from "@/theme";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The tabs in their fixed order. The same order in Hebrew (D-016). Names are the route folders. */
const TABS: { route: string; icon: LucideIcon; label: string; sell?: boolean }[] = [
  { route: "(home)", icon: House, label: "tabs.home" },
  { route: "(shop)", icon: LayoutGrid, label: "tabs.browse" },
  { route: "sell", icon: Tag, label: "tabs.sell", sell: true },
  { route: "(inbox)", icon: MessageCircle, label: "tabs.inbox" },
  { route: "(profile)", icon: User, label: "tabs.profile" },
];

/**
 * A floating rounded bar over the content with icons only (D-019, row 14). The active tab sits on a soft tint
 * pill and Sell is a raised round espresso button with a camera. Each tab keeps its name for screen readers.
 */
export function FloatingTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  if (keyboard) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0"
      style={{ paddingHorizontal: TAB_BAR_SIDE_GAP, paddingBottom: tabBarBottomGap(insets.bottom) }}
    >
      <View
        accessibilityRole="tablist"
        className="flex-row items-center justify-between rounded-bar border border-border-subtle bg-background/95 px-md"
        style={{
          height: TAB_BAR_HEIGHT,
          // Left to right in every language, Home first and Profile last (D-016).
          direction: "ltr",
          shadowColor: colors.text1,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        {TABS.map((tab) => {
          const index = state.routes.findIndex((r) => r.name === tab.route);
          const route = state.routes[index];
          if (!route) return null;
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const badge = options?.tabBarBadge;
          const label = options?.tabBarAccessibilityLabel ?? t(tab.label);

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          if (tab.sell) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                role="button"
                accessibilityLabel={label}
                className="-mt-6 h-14 w-14 items-center justify-center rounded-full bg-primary active:opacity-90"
                style={{
                  shadowColor: colors.text1,
                  shadowOpacity: 0.25,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 10,
                }}
              >
                <Icon as={tab.icon} size={24} className="text-primary-foreground" />
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              role="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              className="h-12 w-14 items-center justify-center"
            >
              <View
                className={`h-10 w-12 items-center justify-center rounded-full ${focused ? "bg-accent-tint" : ""}`}
              >
                <Icon as={tab.icon} size={22} className={focused ? "text-primary" : "text-text-3"} />
                {badge !== undefined && badge !== null && badge !== "" ? (
                  // Tucked onto the icon's top corner. The white ring cuts it out of the icon so the two read as one shape.
                  <View className="absolute end-0.5 top-0 h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-background bg-primary px-[5px]">
                    <Text variant="cardDesc" weight={700} className="text-primary-foreground">
                      {String(badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
