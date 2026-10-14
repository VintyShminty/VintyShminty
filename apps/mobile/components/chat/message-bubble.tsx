import type { Message, MessageOffer } from "@vinty/shared";
import { Image } from "expo-image";
import { AlertCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, useWindowDimensions, View } from "react-native";
import { OfferBubble } from "@/components/chat/offer-bubble";
import { isOrderDivider, OrderDivider } from "@/components/chat/order-divider";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { PendingMessage } from "@/lib/chat-send";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

/** Round corners of a bubble. The corner that points at the sender is tighter (a small tail). */
const TAIL = 3;

type Side = "mine" | "theirs";

function tailStyle(side: Side) {
  return side === "mine" ? { borderEndEndRadius: TAIL } : { borderEndStartRadius: TAIL };
}

function bubbleClass(side: Side) {
  return cn(
    "max-w-[76%] rounded-control px-md py-[9px]",
    side === "mine" ? "self-end bg-primary" : "self-start border border-border bg-background",
  );
}

/** A text bubble. Yours are filled espresso on the end side, theirs are white with a hairline on the start side. */
function TextBubble({ body, side }: { body: string; side: Side }) {
  return (
    <View className={bubbleClass(side)} style={tailStyle(side)}>
      <Text
        className={cn(
          "text-[15px] leading-[21px]",
          side === "mine" ? "text-primary-foreground" : "text-text-1",
        )}
        selectable
      >
        {body}
      </Text>
    </View>
  );
}

/** Width and height of a photo bubble: at most 62% of the screen wide, never taller than it is wide times 1.4. */
function usePhotoSize(width: number | null | undefined, height: number | null | undefined) {
  const screen = useWindowDimensions().width;
  const w = Math.min(Math.round(screen * 0.62), 260);
  const ratio = width && height ? Math.min(Math.max(height / width, 0.6), 1.4) : 1;
  return { width: w, height: Math.round(w * ratio) };
}

function PhotoBubble({
  uri,
  width,
  height,
  side,
  busy,
  failed,
  onOpen,
  label,
}: {
  uri: string;
  width: number | null | undefined;
  height: number | null | undefined;
  side: Side;
  busy?: boolean;
  failed?: boolean;
  onOpen?: () => void;
  label: string;
}) {
  const size = usePhotoSize(width, height);
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      role="button"
      accessibilityLabel={label}
      className={cn(
        "overflow-hidden rounded-control border bg-pressed",
        side === "mine" ? "self-end" : "self-start",
        failed ? "border-error" : "border-border",
      )}
      style={{ ...size, ...tailStyle(side) }}
    >
      <Image
        source={{ uri }}
        style={size}
        contentFit="cover"
        transition={120}
        accessibilityIgnoresInvertColors
      />
      {busy ? (
        <View className="absolute inset-0 items-center justify-center bg-backdrop/30">
          <ActivityIndicator color={colors.onAccent} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** The sentence of a system divider ("Order shipped"). */
function systemText(message: Message, t: (key: string, options?: Record<string, unknown>) => string): string {
  const event = message.systemEvent;
  if (!event) return t("chat.system.other");
  const payload = (message.payload ?? {}) as { amountMinor?: number };
  if (event === "offer_accepted" && typeof payload.amountMinor === "number") {
    return t("chat.system.offer_acceptedAmount", { amount: formatMoney(payload.amountMinor, "ILS") });
  }
  return t(`chat.system.${event}`);
}

/** One message of the chat. */
function MessageBubble({
  message,
  mine,
  tight,
  statusLine,
  onOpenPhoto,
  role,
  offersClosed,
  onCounter,
  onBuy,
}: {
  message: Message;
  mine: boolean;
  tight: boolean;
  /** Small line under the bubble: the time, and Sent or Seen on your newest. */
  statusLine?: string;
  onOpenPhoto: (uri: string) => void;
  /** Which side of the chat I am on, for the offer buttons. */
  role: "buyer" | "seller";
  /** The item is sold: offers can no longer be answered or bought. */
  offersClosed: boolean;
  onCounter: (offer: MessageOffer) => void;
  onBuy: (offer: MessageOffer) => void;
}) {
  const { t } = useTranslation();
  const side: Side = mine ? "mine" : "theirs";

  if (message.kind === "system") {
    if (isOrderDivider(message.systemEvent)) {
      return (
        <OrderDivider
          event={message.systemEvent as string}
          orderId={message.orderId}
          payload={message.payload}
        />
      );
    }
    return (
      <View className="items-center px-xl pb-xs pt-lg">
        <Text variant="cardDesc" className="text-center text-text-3">
          {systemText(message, t)}
        </Text>
      </View>
    );
  }

  let body: React.ReactElement | null = null;
  if (message.kind === "photo" && message.attachment) {
    const uri = message.attachment.url;
    body = (
      <PhotoBubble
        uri={uri}
        width={message.attachment.width}
        height={message.attachment.height}
        side={side}
        label={t("chat.viewPhoto")}
        onOpen={() => onOpenPhoto(uri)}
      />
    );
  } else if (message.kind === "offer") {
    body = message.offer ? (
      <OfferBubble
        offer={message.offer}
        conversationId={message.conversationId}
        mine={mine}
        role={role}
        closed={offersClosed}
        onCounter={onCounter}
        onBuy={onBuy}
      />
    ) : null;
  } else if (message.body) {
    body = <TextBubble body={message.body} side={side} />;
  }
  if (!body) return null;

  return (
    <View className={cn("px-lg", tight ? "pt-xs" : "pt-md")}>
      {body}
      {statusLine ? (
        <Text variant="cardMeta" className={cn("px-xs pt-xs", mine ? "self-end" : "self-start")}>
          {statusLine}
        </Text>
      ) : null}
    </View>
  );
}

/** A message that is still being sent, or could not be. Tap the line under it to try again. */
function PendingBubble({
  pending,
  tight,
  onRetry,
  onDiscard,
  failedText,
}: {
  pending: PendingMessage;
  tight: boolean;
  onRetry: () => void;
  onDiscard: () => void;
  failedText: string;
}) {
  const { t } = useTranslation();
  const failed = pending.state === "failed";
  return (
    <View className={cn("px-lg", tight ? "pt-xs" : "pt-md")}>
      {pending.kind === "photo" && pending.uri ? (
        <PhotoBubble
          uri={pending.uri}
          width={pending.width}
          height={pending.height}
          side="mine"
          busy={!failed}
          failed={failed}
          label={t("chat.photo")}
        />
      ) : (
        <View
          className={cn(bubbleClass("mine"), failed && "border border-error", !failed && "opacity-70")}
          style={tailStyle("mine")}
        >
          <Text className="text-[15px] leading-[21px] text-primary-foreground">{pending.body}</Text>
        </View>
      )}
      {failed ? (
        <View className="flex-row items-center gap-sm self-end pt-xs">
          <Icon as={AlertCircle} size={13} className="text-error" />
          <Pressable onPress={onRetry} hitSlop={8} role="button" accessibilityLabel={failedText}>
            <Text variant="cardMeta" weight={600} className="text-error">
              {failedText}
            </Text>
          </Pressable>
          <Pressable onPress={onDiscard} hitSlop={8} role="button">
            <Text variant="cardMeta" weight={600} className="text-text-2 underline">
              {t("chat.discard")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text variant="cardMeta" className="self-end px-xs pt-xs">
          {t("chat.sending")}
        </Text>
      )}
    </View>
  );
}

export { MessageBubble, PendingBubble };
