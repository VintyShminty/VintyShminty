import type { Photo } from "@vinty/shared";
import { Image } from "expo-image";
import { ImageOff } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, useWindowDimensions, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/** Swipeable full-width photos at 3:4 with a "2 / 5" counter (docs/components.md, PhotoCarousel). */
function PhotoCarousel({ photos, onSwipe }: { photos: Photo[]; onSwipe?: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const height = Math.round((width * 4) / 3);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <View className="items-center justify-center gap-sm bg-surface" style={{ width, height: width }}>
        <Icon as={ImageOff} size={28} className="text-text-4" />
        <Text variant="bodySmall" className="text-text-3">
          {t("listing.noPhotos")}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        // Photos page left to right in both languages. Paging a horizontal list that lays out right to left starts on the wrong photo.
        style={{ direction: "ltr" }}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.key}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          if (next !== index) onSwipe?.();
          setIndex(next);
        }}
        renderItem={({ item, index: i }) => (
          <Image
            source={{ uri: item.url }}
            placeholder={item.placeholder ?? undefined}
            style={{ width, height }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={t("listing.photoLabel", { n: i + 1, total: photos.length })}
            accessibilityIgnoresInvertColors
          />
        )}
      />
      {photos.length > 1 ? (
        <View className="absolute bottom-md end-md rounded-full bg-window px-sm py-xs">
          <Text variant="cardMeta" weight={600} className="text-text-1">
            {t("listing.photoCount", { n: index + 1, total: photos.length })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export { PhotoCarousel };
