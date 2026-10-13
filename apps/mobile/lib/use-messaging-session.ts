import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { routeForNotification } from "@/lib/notification-route";
import { forgetPushToken, refreshPushToken } from "@/lib/push";
import { startRealtime, stopRealtime } from "@/lib/realtime";
import { beforeSignOut } from "@/lib/sign-out-hooks";

/**
 * Everything live that belongs to a signed in person, in one place: the socket, the push token, and opening the right
 * screen when a push is tapped. Used once by the logged in layout.
 */
export function useMessagingSession() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    startRealtime(userId);
    void refreshPushToken();
    const off = beforeSignOut(async () => {
      stopRealtime();
      await forgetPushToken();
    });
    return () => {
      off();
      stopRealtime();
    };
  }, [userId]);

  // A tapped push, whether the app was open, in the background or closed.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = response.notification.request.content.data as Record<string, string | undefined>;
    const href = routeForNotification({
      type: data.type,
      listingId: data.listingId,
      orderId: data.orderId,
      conversationId: data.conversationId,
      userId: data.userId,
    });
    if (href) router.push(href);
  }, [userId, response, router]);
}
