import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { ConversationDetail } from "@vinty/shared";
import { Archive, ArchiveRestore, Bell, BellOff, Flag, MoreHorizontal } from "lucide-react-native";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReportSheet } from "@/components/item/report-sheet";
import { Icon } from "@/components/ui/icon";
import { Row } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";
import { useArchive, useMute } from "@/lib/messaging-queries";

/** The "..." button of a chat and its sheet: archive, mute, report the member. */
function ChatMenu({
  conversation,
  onArchived,
}: {
  conversation: ConversationDetail;
  onArchived: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const menuRef = useRef<BottomSheetModal>(null);
  const reportRef = useRef<BottomSheetModal>(null);
  const archive = useArchive();
  const mute = useMute();

  return (
    <>
      <Pressable
        onPress={() => menuRef.current?.present()}
        hitSlop={8}
        role="button"
        accessibilityLabel={t("chat.menuTitle")}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
      >
        <Icon as={MoreHorizontal} size={22} />
      </Pressable>
      <Sheet ref={menuRef} title={t("chat.menuTitle")} snapPoints={[300]}>
        <View style={{ paddingBottom: insets.bottom + 16 }}>
          <Row
            icon={conversation.archived ? ArchiveRestore : Archive}
            label={conversation.archived ? t("inbox.unarchive") : t("inbox.archive")}
            chevron={false}
            onPress={() => {
              menuRef.current?.dismiss();
              archive.mutate({ id: conversation.id, archived: !conversation.archived });
              // Archiving closes the chat, restoring keeps you in it.
              if (!conversation.archived) onArchived();
            }}
          />
          <Row
            icon={conversation.muted ? Bell : BellOff}
            label={conversation.muted ? t("inbox.unmute") : t("inbox.mute")}
            chevron={false}
            onPress={() => {
              menuRef.current?.dismiss();
              mute.mutate({ id: conversation.id, muted: !conversation.muted });
            }}
          />
          <Row
            icon={Flag}
            label={t("chat.reportMember")}
            destructive
            last
            chevron={false}
            onPress={() => {
              menuRef.current?.dismiss();
              // Wait for the menu to slide away before the next sheet comes up.
              setTimeout(() => reportRef.current?.present(), 250);
            }}
          />
        </View>
      </Sheet>
      <ReportSheet ref={reportRef} targetType="user" targetId={conversation.otherUser.id} />
    </>
  );
}

export { ChatMenu };
