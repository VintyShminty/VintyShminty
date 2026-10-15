import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { X } from "lucide-react-native";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, View } from "react-native";
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
function Sheet({ ref, title, children, action, snapPoints = ["88%"], onChange, ...props }: SheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dismiss = () => (ref && typeof ref === "object" ? ref.current?.dismiss() : undefined);

  // Android back closes the open sheet only, not the screen under it. The newest listener runs first, so a sheet
  // opened over another sheet closes first.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (ref && typeof ref === "object") ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open, ref]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onChange={(index, position, type) => {
        setOpen(index >= 0);
        onChange?.(index, position, type);
      }}
      enableDynamicSizing={false}
      backdropComponent={Backdrop}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      backgroundStyle={{
        // Fully opaque: without the blur the design pairs with 96%, rows behind the sheet would show through.
        backgroundColor: colors.window,
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
            onPress={dismiss}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("common.close")}
            className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
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
