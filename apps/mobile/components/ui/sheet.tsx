import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { X } from "lucide-react-native";
import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, opacity, radii } from "@/theme";

type SheetProps = Omit<BottomSheetModalProps, "children" | "ref"> & {
  ref?: Ref<BottomSheetModal>;
  title: string;
  children: ReactNode;
  /** Text action at the end of the header, for example Clear. */
  action?: { label: string; onPress: () => void };
};

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={opacity.backdrop}
      style={[props.style, { backgroundColor: colors.backdrop }]}
      pressBehavior="close"
    />
  );
}

/**
 * Slide-up sheet (D-004): near-opaque window fill, 20px top corners, hairline border, light dim behind,
 * no shadow. Header: centred title, a close cross, and an optional text action.
 */
function Sheet({ ref, title, children, action, snapPoints = ["88%"], ...props }: SheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={Backdrop}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      backgroundStyle={{
        backgroundColor: colors.window,
        opacity: opacity.window,
        borderTopLeftRadius: radii.window,
        borderTopRightRadius: radii.window,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
      {...props}
    >
      <View className="h-12 flex-row items-center px-sm">
        <View className="w-20 items-start">
          <Pressable
            onPress={() => (ref && typeof ref === "object" ? ref.current?.dismiss() : undefined)}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("common.close")}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
          >
            <Icon as={X} size={22} />
          </Pressable>
        </View>
        <View className="flex-1 items-center">
          <Text variant="heading" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <View className="w-20 items-end pe-sm">
          {action ? (
            <Text
              variant="bodySmall"
              weight={600}
              className="text-primary"
              role="button"
              onPress={action.onPress}
            >
              {action.label}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </BottomSheetModal>
  );
}

export { Sheet };
