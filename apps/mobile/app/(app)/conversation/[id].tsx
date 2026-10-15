import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { MessageOffer } from "@vinty/shared";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, View } from "react-native";
import { KeyboardAvoidingView, KeyboardProvider } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatMenu } from "@/components/chat/chat-menu";
import { Composer } from "@/components/chat/composer";
import { ItemStrip } from "@/components/chat/item-strip";
import { MessageBubble, PendingBubble } from "@/components/chat/message-bubble";
import { OrderTracker } from "@/components/chat/order-tracker";
import { PhotoViewer } from "@/components/chat/photo-viewer";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { OfferSheet } from "@/components/offer/offer-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { BackIcon } from "@/components/ui/top-bar";
import { authClient } from "@/lib/auth-client";
import { quickReplyTarget } from "@/lib/chat-assist";
import { quickRepliesQuery } from "@/lib/chat-assist-queries";
import { buildThreadItems, dayLabel, formatClock, type ThreadItem } from "@/lib/chat-format";
import {
  discardMessage,
  type PendingMessage,
  retryMessage,
  sendNewMessage,
  useChatStore,
} from "@/lib/chat-send";
import { pickListingPhotos } from "@/lib/listing-photos";
import { conversationQuery, messagesQuery } from "@/lib/messaging-queries";
import { useCounterOffer, useSendOffer } from "@/lib/order-flow-queries";
import { setOpenThread } from "@/lib/push";
import { joinThread, leaveThread, markThreadRead, useRealtimeStore } from "@/lib/realtime";
import { photoAssistStatusQuery } from "@/lib/sell-assist";

/** Why a message did not go, in words, for the line under the bubble. */
function failedText(
  p: PendingMessage,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (p.reason === "blocked") return t("chat.blockedSend");
  if (p.reason === "tooFast") {
    return p.retryAfter ? t("chat.tooFastSeconds", { count: p.retryAfter }) : t("chat.tooFast");
  }
  if (p.reason === "network") return t("chat.network");
  return t("chat.other");
}

function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const me = session?.user.id;
  const [photo, setPhoto] = useState<string | null>(null);
  const offerSheet = useRef<BottomSheetModal>(null);
  // null: a new offer from the buyer. Otherwise the offer the sheet answers with a counter.
  const [counterOf, setCounterOf] = useState<MessageOffer | null>(null);
  const sendOffer = useSendOffer();
  const counterOffer = useCounterOffer();

  const detail = useQuery(conversationQuery(id));
  const thread = useInfiniteQuery(messagesQuery(id));
  const allPending = useChatStore((s) => s.pending);
  const otherTyping = useRealtimeStore((s) => Boolean(s.typing[id]));
  const conversation = detail.data;

  // The chat is open: join its live room, hold back pushes for it and keep it marked as read.
  useFocusEffect(
    useCallback(() => {
      joinThread(id);
      setOpenThread(id);
      markThreadRead(id);
      return () => {
        leaveThread(id);
        setOpenThread(null);
      };
    }, [id]),
  );

  const messages = useMemo(() => thread.data?.pages.flatMap((p) => p.items) ?? [], [thread.data]);
  const pending = useMemo(() => allPending.filter((p) => p.conversationId === id), [allPending, id]);
  const items = useMemo(
    () =>
      buildThreadItems({
        messages,
        pending,
        me,
        hasMore: Boolean(thread.hasNextPage),
        otherTyping,
      }),
    [messages, pending, me, thread.hasNextPage, otherTyping],
  );

  // Quick replies (D-041): only when the newest message is a text from the other person and the helper is on.
  const assistStatus = useQuery(photoAssistStatusQuery());
  const target = useMemo(
    () => quickReplyTarget(messages, me, pending.length > 0),
    [messages, me, pending.length],
  );
  const language = i18n.language === "he" ? "he" : "en";
  const quick = useQuery({
    ...quickRepliesQuery(id, target?.id ?? "", language),
    enabled: Boolean(assistStatus.data?.chatAssist) && Boolean(target) && !conversation?.blocked,
  });

  const sendText = (text: string) => {
    if (!me) return;
    sendNewMessage({ conversationId: id, senderId: me, kind: "text", body: text });
  };

  const pickPhoto = async () => {
    if (!me) return;
    const picked = await pickListingPhotos("library", 1);
    if (picked.status === "denied") {
      Alert.alert(t("sell.photos.deniedTitle"), t("sell.photos.denied"));
      return;
    }
    const first = picked.status === "picked" ? picked.photos[0] : undefined;
    if (!first) return;
    sendNewMessage({
      conversationId: id,
      senderId: me,
      kind: "photo",
      uri: first.uri,
      width: first.width,
      height: first.height,
    });
  };

  const openOfferSheet = (counter: MessageOffer | null) => {
    setCounterOf(counter);
    offerSheet.current?.present();
  };
  const buyAtOffer = (offer: MessageOffer) =>
    router.push({ pathname: "/checkout", params: { offerId: offer.id } });
  // Once the item is sold or an order is paid, old offers are history.
  const orderStatus = conversation?.order?.status;
  const offersClosed =
    conversation?.listing.status === "sold" ||
    Boolean(orderStatus && !["pending_payment", "cancelled", "refunded"].includes(orderStatus));
  const canOffer =
    conversation?.role === "buyer" && conversation.listing.status === "active" && !conversation.blocked;

  const otherName = conversation?.otherUser.username ?? t("profile.closedAccount");
  const otherLastReadAt = conversation?.otherLastReadAt ?? null;

  const renderItem = ({ item }: { item: ThreadItem }) => {
    switch (item.type) {
      // No person card in the chat, on the app or the website: the top bar already shows who it is (D-034).
      case "intro":
        return null;
      case "typing":
        return <TypingIndicator name={otherName} />;
      case "day":
        return (
          <Text variant="cardMeta" className="py-md text-center">
            {dayLabel(item.iso, i18n.language, { today: t("chat.today"), yesterday: t("chat.yesterday") })}
          </Text>
        );
      case "pending":
        return (
          <PendingBubble
            pending={item.pending}
            tight={item.tight}
            failedText={failedText(item.pending, t)}
            onRetry={() => retryMessage(item.pending.clientMessageId)}
            onDiscard={() => discardMessage(item.pending.clientMessageId)}
          />
        );
      case "message": {
        const clock = formatClock(item.message.createdAt, i18n.language);
        let statusLine: string | undefined;
        if (item.lastMine) {
          const seen = otherLastReadAt !== null && otherLastReadAt >= item.message.createdAt;
          statusLine = `${clock} · ${seen ? t("chat.seen") : t("chat.sent")}`;
        } else if (item.groupEnd && item.message.kind !== "system") {
          statusLine = clock;
        }
        return (
          <MessageBubble
            message={item.message}
            mine={item.mine}
            tight={item.tight}
            statusLine={statusLine}
            onOpenPhoto={setPhoto}
            role={conversation?.role ?? "buyer"}
            offersClosed={offersClosed}
            onCounter={openOfferSheet}
            onBuy={buyAtOffer}
            me={me}
          />
        );
      }
    }
  };

  let body: React.ReactElement;
  if (detail.isPending || (thread.isPending && !thread.data)) {
    body = <Spinner className="flex-1" />;
  } else if (detail.isError || !conversation) {
    body = (
      <View className="flex-1 items-center justify-center gap-md px-xl">
        <Text variant="heading" className="text-center">
          {t("chat.loadFailed")}
        </Text>
        <Button
          variant="outline"
          onPress={() => {
            void detail.refetch();
            void thread.refetch();
          }}
        >
          <Text>{t("common.tryAgain")}</Text>
        </Button>
      </View>
    );
  } else {
    body = (
      <>
        <ItemStrip listing={conversation.listing} />
        {conversation.order ? <OrderTracker orderId={conversation.order.id} /> : null}
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <FlatList
            inverted
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage();
            }}
            ListFooterComponent={thread.isFetchingNextPage ? <Spinner /> : null}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
          {conversation.blocked ? (
            <View
              className="border-t border-border-subtle bg-surface px-lg pt-md"
              style={{ paddingBottom: insets.bottom + 12 }}
            >
              <Text variant="bodySmall" className="text-center text-text-2">
                {t("chat.blockedNote")}
              </Text>
            </View>
          ) : (
            <Composer
              conversationId={id}
              quickReplies={
                target && quick.data
                  ? {
                      forMessageId: quick.data.forMessageId,
                      newestId: target.id,
                      replies: quick.data.replies,
                    }
                  : undefined
              }
              onSend={sendText}
              onPickPhoto={() => void pickPhoto()}
              onOffer={canOffer ? () => openOfferSheet(null) : undefined}
            />
          )}
        </KeyboardAvoidingView>
      </>
    );
  }

  return (
    <KeyboardProvider>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-14 flex-row items-center px-sm">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/inbox"))}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("common.back")}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
          >
            <BackIcon />
          </Pressable>
          <Pressable
            onPress={() =>
              conversation?.otherUser.username &&
              router.push({ pathname: "/user/[id]", params: { id: conversation.otherUser.id } })
            }
            role="button"
            accessibilityLabel={t("chat.openProfile", { name: otherName })}
            className="flex-1 flex-row items-center gap-sm ps-xs"
          >
            <Avatar
              uri={conversation?.otherUser.avatarUrl}
              name={conversation?.otherUser.username}
              size={36}
            />
            <Text variant="heading" numberOfLines={1} className="flex-1">
              {conversation ? otherName : ""}
            </Text>
          </Pressable>
          {conversation ? (
            <ChatMenu conversation={conversation} onArchived={() => router.back()} />
          ) : (
            <View className="w-11" />
          )}
        </View>
        {body}
        <PhotoViewer uri={photo} onClose={() => setPhoto(null)} />
        {conversation ? (
          <OfferSheet
            ref={offerSheet}
            mode={counterOf ? "counter" : "make"}
            listingPriceMinor={counterOf?.listingPriceMinor ?? conversation.listing.priceMinor}
            currency={conversation.listing.currency}
            showQuota={conversation.role === "buyer"}
            onSend={async (amountMinor) => {
              if (counterOf) await counterOffer.mutateAsync({ offerId: counterOf.id, amountMinor });
              else await sendOffer.mutateAsync({ conversationId: id, amountMinor });
            }}
          />
        ) : null}
      </View>
    </KeyboardProvider>
  );
}

export default ConversationScreen;
