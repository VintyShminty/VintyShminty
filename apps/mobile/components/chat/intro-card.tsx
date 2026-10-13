import type { ConversationDetail } from "@vinty/shared";
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StarRating } from "@/components/ui/star-rating";
import { Text } from "@/components/ui/text";
import { timeAgo } from "@/lib/time";

/** The other person's card at the very top of a chat: who they are, where, when they were last around. */
function IntroCard({ person }: { person: ConversationDetail["otherUser"] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = person.username ?? t("profile.closedAccount");
  return (
    <Pressable
      onPress={() => person.username && router.push({ pathname: "/user/[id]", params: { id: person.id } })}
      role="button"
      accessibilityLabel={t("chat.openProfile", { name })}
      className="mx-lg mb-md mt-lg items-center gap-sm rounded-window border border-border-subtle bg-surface p-lg"
    >
      <Avatar uri={person.avatarUrl} name={person.username} size={64} />
      <Text variant="heading" numberOfLines={1}>
        {name}
      </Text>
      {person.reviewCount > 0 ? (
        <View className="flex-row items-center gap-sm">
          <StarRating rating={person.ratingAverage} />
          <Text variant="cardMeta">{t("profile.reviewCount", { count: person.reviewCount })}</Text>
        </View>
      ) : (
        <Text variant="cardMeta">{t("item.noReviews")}</Text>
      )}
      {person.city ? (
        <View className="flex-row items-center gap-xs">
          <Icon as={MapPin} size={13} className="text-text-3" />
          <Text variant="bodySmall" className="text-text-2">
            {person.city}
          </Text>
        </View>
      ) : null}
      {person.lastSeenAt ? (
        <Text variant="cardMeta">{t("profile.about.lastSeen", { when: timeAgo(person.lastSeenAt, t) })}</Text>
      ) : null}
    </Pressable>
  );
}

export { IntroCard };
