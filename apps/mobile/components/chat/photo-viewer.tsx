import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";
import { useIsLocked } from "@/lib/lock-store";

/** A chat photo full screen. Tap anywhere or the cross to close. */
function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // A native window opens above the Face ID lock, so it stays hidden while the app is locked.
  const { data: session } = authClient.useSession();
  const locked = useIsLocked(session?.user.id);
  return (
    <Modal
      visible={uri !== null && !locked}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-text-1"
        accessibilityLabel={t("common.close")}
        role="button"
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
        ) : null}
        <View style={{ position: "absolute", top: insets.top + 8, end: 12 }}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-backdrop/60">
            <Icon as={X} size={24} className="text-primary-foreground" />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export { PhotoViewer };
