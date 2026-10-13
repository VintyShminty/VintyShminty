import type { ConversationRow as Row } from "@vinty/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { BellOff, Camera, Tag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatRowTime } from "@/lib/chat-format";
import { useArchive, useMute } from "@/lib/messaging-queries";
import { cn } from "@/lib/utils";

/** What the second line says: the text, or a word for a photo, an offer or a divider. */
function PreviewLine({ row, unread }: { row: Row; unread: boolean }) {
  const { t } = useTranslation();
  const tone = unread ? "text-text-1" : "text-text-3";
  if (row.lastMessageKind === "photo") {
    return (
      <View className="flex-row items-center gap-xs">
        <Icon as={Camera} size={14} className={tone} />
        <Text
          variant="bodySmall"
          weight={unread ? 600 : 400}
          className={cn("flex-1", tone)}
          numberOfLines={1}
        >
          {t("inbox.previewPhoto")}
        </Text>
      </View>
    );
  }
  if (row.lastMessageKind === "offer") {
    return (
      <View className="flex-row items-center gap-xs">
        <Icon as={Tag} size={14} className={tone} />
        <Text
          variant="bodySmall"
          weight={unread ? 600 : 400}
          className={cn("flex-1", tone)}
          numberOfLines={1}
        >
          {t("inbox.previewOffer")}
        </Text>
      </View>
    );
  }
  return (
    <Text variant="bodySmall" weight={unread ? 600 : 400} className={tone} numberOfLines={1}>
      {row.lastMessageKind === "system" ? t("inbox.previewSystem") : (row.lastMessagePreview ?? "")}
    </Text>
  );
}

/**
 * One chat in the inbox (docs/components.md, ConversationRow): the other person, the item's thumbnail, the last
 * message, the time, a dot when unread (name and text turn bold) and a muted bell. Long press for archive and mute.
 */
function ConversationRow({ row }: { row: Row }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const archive = useArchive();
  const mute = useMute();
  const name = row.otherUser.username ?? t("profile.deletedMember");

  const openOptions = () =>
    Alert.alert(name, row.listing.title, [
      {
        text: row.archived ? t("inbox.unarchive") : t("inbox.archive"),
        onPress: () => archive.mutate({ id: row.id, archived: !row.archived }),
      },
      {
        text: row.muted ? t("inbox.unmute") : t("inbox.mute"),
        onPress: () => mute.mutate({ id: row.id, muted: !row.muted }),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/conversation/[id]", params: { id: row.id } })}
      onLongPress={openOptions}
      role="button"
      accessibilityLabel={[row.unread ? t("inbox.unread") : null, name, row.listing.title]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={t("inbox.options")}
      className="flex-row items-center gap-md px-lg py-md active:bg-surface"
    >
      <Avatar uri={row.otherUser.avatarUrl} name={row.otherUser.username} size={52} />
      <View className="flex-1 gap-px">
        <View className="flex-row items-center gap-sm">
          <Text weight={row.unread ? 800 : 600} numberOfLines={1} className="flex-1">
            {name}
          </Text>
          {row.muted ? (
            <Icon as={BellOff} size={13} className="text-text-4" accessibilityLabel={t("inbox.muted")} />
          ) : null}
          <Text variant="cardMeta" className={row.unread ? "text-text-1" : undefined}>
            {formatRowTime(row.lastMessageAt, i18n.language)}
          </Text>
        </View>
        <Text variant="cardDesc" numberOfLines={1}>
          {row.listing.title}
        </Text>
        <View className="flex-row items-center gap-sm">
          <View className="flex-1">
            <PreviewLine row={row} unread={row.unread} />
          </View>
          {row.unread ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </View>
      </View>
      <View className="h-[52px] w-[52px] overflow-hidden rounded-control bg-pressed">
        {row.listing.photoUrl ? (
          <Image
            source={{ uri: row.listing.photoUrl }}
            style={{ width: 52, height: 52 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export { ConversationRow };
