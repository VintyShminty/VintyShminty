import { Image } from "expo-image";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { type ImageSourcePropType, Pressable, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const TURN = { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };

/**
 * The More tile (D-055): four small pictures of the categories behind it, the word More and how many there are.
 * It opens the rest in place and becomes "Show less" (the arrow turns over).
 */
export function BrowseMoreTile({
  previews,
  count,
  expanded,
  onPress,
}: {
  previews: ImageSourcePropType[];
  count: number;
  expanded: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const arrow = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(expanded ? "180deg" : "0deg", TURN) }],
  }));
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={expanded ? t("browse.less") : t("browse.moreTitle")}
      accessibilityState={{ expanded }}
      className="h-24 flex-row items-center gap-md overflow-hidden rounded-control bg-accent-tint pe-lg active:opacity-90"
    >
      <View className="h-24 w-24 flex-row flex-wrap gap-[2px]" accessibilityElementsHidden>
        {previews.slice(0, 4).map((source, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the four pictures never reorder
          <View key={i} className="h-[47px] w-[47px] overflow-hidden bg-pressed">
            <Image
              source={source}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
              accessibilityIgnoresInvertColors
            />
          </View>
        ))}
      </View>
      <View className="flex-1">
        <Text variant="heading" weight={700} className="text-primary">
          {expanded ? t("browse.less") : t("browse.more")}
        </Text>
        <Text variant="bodySmall" className="text-text-3">
          {t("browse.moreCount", { count })}
        </Text>
      </View>
      <Animated.View style={arrow}>
        <Icon as={ChevronDown} size={20} className="text-primary" />
      </Animated.View>
    </Pressable>
  );
}
