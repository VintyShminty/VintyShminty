import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { NotificationsList } from "@/components/inbox/notifications-list";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { unreadQuery, useMarkNotificationsRead } from "@/lib/messaging-queries";

/** Notifications as its own page, opened by the bell on Home. It slides in over Home and swipes back (D-047). */
export default function Notifications() {
  const { t } = useTranslation();
  const unread = useQuery(unreadQuery());
  const markAll = useMarkNotificationsRead();
  const notificationsUnread = (unread.data?.notifications ?? 0) > 0;

  return (
    <Screen bottomInset={false}>
      <TopBar
        title={t("inbox.notifications")}
        wideSides
        trailing={
          notificationsUnread ? (
            <Pressable onPress={() => markAll.mutate(undefined)} hitSlop={8} role="button">
              <Text variant="bodySmall" weight={600} className="text-primary">
                {t("inbox.markAllRead")}
              </Text>
            </Pressable>
          ) : null
        }
      />
      <NotificationsList />
    </Screen>
  );
}
