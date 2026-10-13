import type { MessageOffer } from "@vinty/shared";
import { Check, Clock, CornerUpLeft, Hourglass, Undo2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { formatClock, sameDay } from "@/lib/chat-format";
import { formatMoney } from "@/lib/money";
import { type OfferAnswer, useAnswerOffer } from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";

type Props = {
  offer: MessageOffer;
  conversationId: string;
  /** I made this offer. */
  mine: boolean;
  /** Which side of the chat I am on. */
  role: "buyer" | "seller";
  /** The item is sold (or an order is paid): nothing can be done with an offer any more. */
  closed: boolean;
  onCounter: (offer: MessageOffer) => void;
  onBuy: (offer: MessageOffer) => void;
};

const STATUS_ICON = {
  pending: Hourglass,
  accepted: Check,
  declined: X,
  countered: CornerUpLeft,
  withdrawn: Undo2,
  expired: Clock,
} as const;

const STATUS_VARIANT = {
  pending: "accent",
  accepted: "success",
  declined: "error",
  countered: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
} as const;

/**
 * An offer in the chat (docs/components.md, OfferBubble): the price, the listed price struck through, the state, and
 * the buttons that make sense for me right now. The other person's waiting offer can be accepted, declined or
 * countered. My own waiting offer can be withdrawn. An accepted offer lets the buyer buy at that price until the hold
 * runs out.
 */
function OfferBubble({ offer, conversationId, mine, role, closed, onCounter, onBuy }: Props) {
  const { t, i18n } = useTranslation();
  const answer = useAnswerOffer();
  // The server turns old offers into expired a little later. The bubble does not wait.
  const timedOut = new Date(offer.expiresAt).getTime() <= Date.now();
  const status =
    (offer.status === "pending" || offer.status === "accepted") && timedOut ? "expired" : offer.status;
  const lower = offer.amountMinor < offer.listingPriceMinor;

  const run = (kind: OfferAnswer) =>
    answer.mutate(
      { offerId: offer.id, answer: kind },
      {
        onError: (err) =>
          Alert.alert(
            err instanceof ApiClientError && err.status === 409
              ? t("offer.errors.closed")
              : t("errors.general"),
          ),
      },
    );
  const confirm = (kind: "decline" | "withdraw") =>
    Alert.alert(t(`offer.confirm.${kind}Title`), t(`offer.confirm.${kind}Note`), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t(`offer.${kind}`), style: "destructive", onPress: () => run(kind) },
    ]);

  const busy = answer.isPending;
  const canAnswer = status === "pending" && !closed;
  // A hold that runs into tomorrow shows its day too, a bare clock time would read as already over.
  const until = sameDay(new Date(offer.expiresAt), new Date())
    ? formatClock(offer.expiresAt, i18n.language)
    : new Date(offer.expiresAt).toLocaleString(i18n.language, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <View
      className={cn(
        "w-[78%] gap-sm rounded-window border border-border bg-surface px-md py-md",
        mine ? "self-end" : "self-start",
      )}
      data-conversation={conversationId}
    >
      <Text variant="sectionLabel">{mine ? t("offer.bubble.yours") : t("offer.bubble.theirs")}</Text>
      <View className="flex-row items-baseline gap-sm">
        <Text variant="title" className="text-primary">
          {formatMoney(offer.amountMinor, offer.currency)}
        </Text>
        {lower ? (
          <Text variant="cardDesc" className="text-text-3 line-through">
            {formatMoney(offer.listingPriceMinor, offer.currency)}
          </Text>
        ) : null}
      </View>
      <Badge
        className="self-start"
        variant={STATUS_VARIANT[status]}
        icon={STATUS_ICON[status]}
        label={
          status === "pending"
            ? t(`offer.bubble.pending_${mine ? "mine" : "theirs"}`)
            : t(`chat.offerStatus.${status}`)
        }
      />

      {status === "accepted" ? (
        <Text variant="cardDesc" className="text-text-2">
          {role === "buyer"
            ? t("offer.bubble.reservedForYou", { time: until })
            : t("offer.bubble.reservedForThem", { time: until })}
        </Text>
      ) : null}

      {canAnswer && !mine ? (
        <View className="gap-sm pt-xs">
          <Button size="sm" loading={busy} onPress={() => run("accept")}>
            <Text>{t("offer.accept")}</Text>
          </Button>
          <View className="flex-row gap-sm">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={busy}
              onPress={() => confirm("decline")}
            >
              <Text>{t("offer.decline")}</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={busy}
              onPress={() => onCounter(offer)}
            >
              <Text>{t("offer.counter")}</Text>
            </Button>
          </View>
        </View>
      ) : null}

      {canAnswer && mine ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-xs"
          loading={busy}
          onPress={() => confirm("withdraw")}
        >
          <Text>{t("offer.withdraw")}</Text>
        </Button>
      ) : null}

      {status === "accepted" && role === "buyer" && !closed ? (
        <Button size="sm" className="mt-xs" onPress={() => onBuy(offer)}>
          <Text>{t("offer.buyNow", { amount: formatMoney(offer.amountMinor, offer.currency) })}</Text>
        </Button>
      ) : null}
    </View>
  );
}

export { OfferBubble };
