import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type AvatarProps = {
  uri?: string | null;
  /** Used for the initial when there is no photo, or the photo fails to load. */
  name?: string | null;
  size?: number;
  className?: string;
};

/** Round profile picture. On a missing or broken photo it shows the first letter (docs/design.md, Images). Never tinted. */
function Avatar({ uri, name, size = 40, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const showImage = Boolean(uri) && !failed;
  return (
    <View
      className={cn("items-center justify-center overflow-hidden rounded-full bg-pressed", className)}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          weight={700}
          className="text-text-2"
          style={{ fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.5) }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

export { Avatar };
