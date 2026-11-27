import { Check, Shirt, Smartphone, Sun, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const TIPS = [
  { key: "upright", icon: Smartphone },
  { key: "wholeItem", icon: Shirt },
  { key: "light", icon: Sun },
] as const;

/** One drawn example: a frame with a shirt in it and a Like this or Not like this label under it. */
function Example({ good }: { good: boolean }) {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-sm">
      <View
        className={
          good
            ? "h-[136px] w-[88px] items-center justify-center overflow-hidden rounded-control border-[1.5px] border-text-3 bg-surface"
            : "h-[88px] w-[136px] items-end justify-end overflow-hidden rounded-control border-[1.5px] border-text-3 bg-surface"
        }
      >
        {good ? (
          <Icon as={Shirt} size={56} className="text-text-3" />
        ) : (
          // Too big and pushed past the corner, so part of it is cut off, like a photo taken sideways and too close.
          <View className="-mb-[30px] -me-[34px]">
            <Icon as={Shirt} size={92} className="text-text-3" />
          </View>
        )}
      </View>
      <View className="flex-row items-center gap-xs">
        <Icon as={good ? Check : X} size={16} className={good ? "text-success" : "text-error"} />
        <Text variant="bodySmall" weight={600} className={good ? "text-success" : "text-error"}>
          {t(good ? "sell.photos.guide.good" : "sell.photos.guide.bad")}
        </Text>
      </View>
    </View>
  );
}

/**
 * The photo example a first time seller sees after tapping Add your photos (D-067): a drawn right and wrong photo,
 * the three tips and Got it. Got it goes on to the photo choices, the cross closes it without adding photos.
 */
function PhotoGuide({
  visible,
  onDone,
  onClose,
}: {
  visible: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      animationType={reduced ? "none" : "slide"}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-background px-lg"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={onClose}
          hitSlop={12}
          role="button"
          accessibilityLabel={t("sell.photos.guide.close")}
          className="self-start py-sm"
        >
          <Icon as={X} size={24} className="text-text-1" />
        </Pressable>
        <View className="mt-lg gap-xs">
          <Text variant="title">{t("sell.photos.guide.title")}</Text>
          <Text variant="body" className="text-text-3">
            {t("sell.photos.guide.subtitle")}
          </Text>
        </View>
        <View className="mt-2xl flex-row items-end justify-center gap-xl">
          <Example good />
          <Example good={false} />
        </View>
        <View className="mt-2xl gap-md">
          {TIPS.map((tip) => (
            <View key={tip.key} className="flex-row items-center gap-md">
              <Icon as={tip.icon} size={20} className="text-text-3" />
              <Text variant="body">{t(`sell.photos.firstTips.${tip.key}`)}</Text>
            </View>
          ))}
        </View>
        <View className="flex-1" />
        <Button onPress={onDone}>
          <Text>{t("sell.photos.guide.gotIt")}</Text>
        </Button>
      </View>
    </Modal>
  );
}

export { PhotoGuide };
