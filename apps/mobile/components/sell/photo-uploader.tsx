import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Camera, Plus, TriangleAlert, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedRef, useReducedMotion } from "react-native-reanimated";
import Sortable from "react-native-sortables";
import { PhotoViewer } from "@/components/sell/photo-viewer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type PickedPhoto, pickListingPhotos, shrinkPhoto, uploadListingPhoto } from "@/lib/listing-photos";
import { movePhoto } from "@/lib/move-photo";
import { useIsRtl } from "@/lib/rtl";
import { newPhotoId, type SellPhoto, useSellStore } from "@/lib/sell-store";
import { cn } from "@/lib/utils";

const GAP = 8;
const SIDE = 16;

/** Shrinks then uploads one photo, keeping its tile up to date. */
async function sendPhoto(id: string, picked: PickedPhoto) {
  const { updatePhoto } = useSellStore.getState();
  try {
    const small = await shrinkPhoto(picked);
    updatePhoto(id, { uri: small.uri, width: small.width, height: small.height });
    const upload = await uploadListingPhoto(small, (progress) => updatePhoto(id, { progress }));
    updatePhoto(id, { key: upload.key, state: "done", progress: 1 });
  } catch (err) {
    if (__DEV__) console.warn("Listing photo upload failed:", err);
    updatePhoto(id, { state: "failed" });
  }
}

/**
 * The photo tiles of the sell form (docs/components.md, PhotoUploader): an empty dashed box, then square tiles with
 * a remove cross, a Cover tag on the first photo, upload progress and a retry state. Press and hold a tile, then
 * drag it to move it (the first place is the cover). A tap opens the photo full screen. Up to the platform limit.
 */
function PhotoUploader({ maxPhotos, error }: { maxPhotos: number; error?: string }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = useIsRtl();
  const reduced = useReducedMotion();
  const [viewing, setViewing] = useState<number | null>(null);
  const photos = useSellStore((s) => s.values.photos);
  const set = useSellStore((s) => s.set);
  const clearError = useSellStore((s) => s.clearError);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const tile = Math.floor((width - SIDE * 2 - GAP * 3) / 4);
  const remaining = maxPhotos - photos.length;

  const add = async (source: "library" | "camera") => {
    const picked = await pickListingPhotos(source, remaining);
    if (picked.status === "denied") {
      Alert.alert(t("sell.photos.deniedTitle"), t("sell.photos.denied"));
      return;
    }
    if (picked.status !== "picked") return;
    const tiles: SellPhoto[] = picked.photos.map((p) => ({
      id: newPhotoId(),
      uri: p.uri,
      width: p.width,
      height: p.height,
      state: "uploading",
      progress: 0,
    }));
    set({ photos: [...useSellStore.getState().values.photos, ...tiles] });
    clearError("photos");
    for (const [index, tileData] of tiles.entries()) {
      await sendPhoto(tileData.id, picked.photos[index] as PickedPhoto);
    }
  };

  const chooseSource = () => {
    if (remaining <= 0) return;
    Alert.alert(t("sell.photos.addTitle"), undefined, [
      { text: t("sell.photos.library"), onPress: () => void add("library") },
      { text: t("sell.photos.camera"), onPress: () => void add("camera") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const drop = (from: number, to: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (from === to) return;
    set({ photos: movePhoto(useSellStore.getState().values.photos, from, to) });
  };

  const remove = (id: string) =>
    set({ photos: useSellStore.getState().values.photos.filter((p) => p.id !== id) });

  const openTile = (photo: SellPhoto, index: number) => {
    if (photo.state === "failed") {
      useSellStore.getState().updatePhoto(photo.id, { state: "uploading", progress: 0 });
      void sendPhoto(photo.id, { uri: photo.uri, width: photo.width, height: photo.height });
      return;
    }
    setViewing(index);
  };

  if (photos.length === 0) {
    return (
      <View className="gap-xs">
        <View
          className={cn(
            "h-[156px] items-center justify-center gap-md rounded-window border-[1.5px] border-dashed bg-surface",
            error ? "border-error" : "border-text-4",
          )}
        >
          <Icon as={Camera} size={28} className="text-text-3" />
          <Button variant="outline" onPress={chooseSource}>
            <Icon as={Plus} size={18} />
            <Text>{t("sell.photos.upload")}</Text>
          </Button>
        </View>
        {error ? (
          <Text variant="cardDesc" className="text-error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : (
          <Text variant="cardDesc" className="text-text-3">
            {t("sell.photos.hint", { max: maxPhotos })}
          </Text>
        )}
      </View>
    );
  }

  const addBox = (
    <Pressable
      onPress={chooseSource}
      role="button"
      accessibilityLabel={t("sell.photos.add")}
      className="items-center justify-center rounded-control border-[1.5px] border-dashed border-text-4 bg-surface active:bg-pressed"
      style={{ width: tile, height: tile }}
    >
      <Icon as={Plus} size={24} className="text-primary" />
    </Pressable>
  );
  const failed = photos.some((p) => p.state === "failed");
  return (
    <View className="gap-sm">
      {/* One line: the photos, then the add box. It scrolls sideways when there are many. The sorting library
          knows nothing about right to left, so everything is laid out left to right and, in Hebrew, the first photo
          is put on the right with row-reverse, the add box on the left and the line starts scrolled to the right. */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => {
          if (rtl) scrollRef.current?.scrollToEnd({ animated: false });
        }}
        style={{ direction: "ltr", marginHorizontal: -SIDE }}
        contentContainerStyle={{
          paddingHorizontal: SIDE,
          minWidth: width,
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: rtl ? "flex-end" : "flex-start",
          gap: GAP,
        }}
      >
        {rtl && remaining > 0 ? addBox : null}
        <View style={{ width: photos.length * tile + (photos.length - 1) * GAP, flexGrow: 0, flexShrink: 0 }}>
          <Sortable.Flex
            flexDirection={rtl ? "row-reverse" : "row"}
            flexWrap="nowrap"
            gap={GAP}
            width="fill"
            scrollableRef={scrollRef}
            autoScrollDirection="horizontal"
            autoScrollEnabled
            dragActivationDelay={reduced ? 150 : 200}
            activeItemScale={reduced ? 1 : 1.06}
            activationAnimationDuration={reduced ? 0 : 150}
            dropAnimationDuration={reduced ? 0 : 200}
            onDragStart={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            onDragEnd={({ fromIndex, toIndex }) => drop(fromIndex, toIndex)}
          >
            {photos.map((photo, index) => (
              <View key={photo.id}>
                <Pressable
                  onPress={() => openTile(photo, index)}
                  role="button"
                  accessibilityLabel={
                    photo.state === "failed"
                      ? t("sell.photos.retry")
                      : t("sell.photos.tileLabel", { n: index + 1, total: photos.length })
                  }
                  className={cn(
                    "overflow-hidden rounded-control border bg-pressed",
                    photo.state === "failed" ? "border-error" : "border-border-subtle",
                  )}
                  style={{ width: tile, height: tile }}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width: "100%", height: "100%", opacity: photo.state === "done" ? 1 : 0.5 }}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <Pressable
                    onPress={() => remove(photo.id)}
                    hitSlop={6}
                    role="button"
                    accessibilityLabel={t("sell.photos.remove")}
                    className="absolute end-xs top-xs h-5 w-5 items-center justify-center rounded-full bg-window"
                  >
                    <Icon
                      as={photo.state === "failed" ? TriangleAlert : X}
                      size={12}
                      className={photo.state === "failed" ? "text-error" : undefined}
                    />
                  </Pressable>
                  {index === 0 ? (
                    <View className="absolute bottom-xs start-xs rounded-full bg-window px-[6px] py-[2px]">
                      <Text variant="badge" weight={700}>
                        {t("sell.photos.main")}
                      </Text>
                    </View>
                  ) : null}
                  {photo.state === "uploading" ? (
                    <View className="absolute inset-x-0 bottom-0 p-[6px]">
                      <View className="h-1 overflow-hidden rounded-full bg-window">
                        <View
                          className="h-1 bg-primary"
                          style={{ width: `${Math.round(photo.progress * 100)}%` }}
                        />
                      </View>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            ))}
          </Sortable.Flex>
        </View>
        {!rtl && remaining > 0 ? addBox : null}
      </Animated.ScrollView>
      <PhotoViewer photos={photos} startIndex={viewing} onClose={() => setViewing(null)} />
      <Text variant="cardDesc" className={failed || error ? "text-error" : "text-text-3"}>
        {failed
          ? t("sell.photos.failed")
          : (error ?? t("sell.photos.count", { count: photos.length, max: maxPhotos }))}
      </Text>
    </View>
  );
}

export { PhotoUploader };
