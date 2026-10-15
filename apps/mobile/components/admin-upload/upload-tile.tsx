import { Image } from "expo-image";
import { TriangleAlert, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { UploadPhoto } from "@/lib/admin-upload";
import { cn } from "@/lib/utils";

type UploadTileProps = {
  photo: UploadPhoto;
  size: number;
  /** Place in the selection (1, 2, 3). Absent when the photo is not selected. */
  order?: number;
  onPress?: () => void;
  /** A cross in the top end corner. */
  onRemove?: () => void;
  accessibilityLabel: string;
};

/**
 * A square photo of the batch upload: the picture, a progress bar while it goes up, a retry state when it failed,
 * and the selection number when it is picked for a new item.
 */
function UploadTile({ photo, size, order, onPress, onRemove, accessibilityLabel }: UploadTileProps) {
  const { t } = useTranslation();
  const selected = order !== undefined;
  return (
    <View style={{ width: size, height: size }}>
      <Pressable
        onPress={onPress}
        role="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        className={cn(
          "h-full w-full overflow-hidden rounded-control bg-pressed",
          selected ? "border-2 border-primary" : "border border-border-subtle",
        )}
      >
        <Image
          source={{ uri: photo.uri }}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
          accessibilityIgnoresInvertColors
        />
        {photo.state === "uploading" ? (
          <View className="absolute inset-x-0 bottom-0 h-1 bg-backdrop">
            <View className="h-1 bg-primary" style={{ width: `${Math.round(photo.progress * 100)}%` }} />
          </View>
        ) : null}
        {photo.state === "failed" ? (
          <View className="absolute inset-0 items-center justify-center gap-xs bg-backdrop p-xs">
            <Icon as={TriangleAlert} size={20} className="text-primary-foreground" />
            <Text variant="smallLabel" className="text-center text-primary-foreground" numberOfLines={2}>
              {t("adminUpload.photos.failed")}
            </Text>
          </View>
        ) : null}
        {selected ? (
          <View className="absolute start-xs top-xs h-6 w-6 items-center justify-center rounded-full bg-primary">
            <Text variant="smallLabel" weight={700} className="text-primary-foreground">
              {order}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={6}
          role="button"
          accessibilityLabel={t("adminUpload.photos.remove")}
          className="absolute end-xs top-xs h-6 w-6 items-center justify-center rounded-full bg-backdrop"
        >
          <Icon as={X} size={14} className="text-primary-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}

export { UploadTile };
