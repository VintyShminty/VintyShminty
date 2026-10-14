import { Image } from "expo-image";
import { type ImageSourcePropType, Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

type PhotoTileProps = {
  label: string;
  /** A picture bundled in the app. Without one the tile is a plain tint. */
  photo?: ImageSourcePropType;
  onPress: () => void;
  className?: string;
};

/** A Browse tile: a photo with the name at the bottom over a soft dark gradient (D-019, row 5). */
function PhotoTile({ label, photo, onPress, className }: PhotoTileProps) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={label}
      className={cn("overflow-hidden rounded-control bg-pressed active:opacity-90", className)}
    >
      {photo ? (
        <Image
          source={photo}
          contentFit="cover"
          transition={200}
          style={{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0 }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View className="absolute inset-x-0 bottom-0 h-3/5" pointerEvents="none">
        {/* The gradient reads its colour from the tokens (text-1, the dark brown), so no hex lives here. */}
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="tile-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.text1} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.text1} stopOpacity={0.78} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#tile-fade)" />
        </Svg>
      </View>
      <View className="absolute inset-x-0 bottom-0 p-md">
        <Text variant="heading" weight={700} numberOfLines={2} className="text-primary-foreground">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export { PhotoTile };
