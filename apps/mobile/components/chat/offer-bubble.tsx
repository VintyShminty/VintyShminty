import type { MessageOffer } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { formatClock, sameDay } from "@/lib/chat-format";
import { formatMoney } from "@/lib/money";
import { type OfferAnswer, useAnswerOffer } from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

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

/**
 * An offer in the chat (docs/components.md, OfferBubble, D-034): a full width ledger line with who and the state on
 * one side, the price and the listed price struck through on the other, and a thin bar of the actions that make sense
 * for me right now. The other person's waiting offer can be accepted, declined or
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
      {
        text: t(`offer.${kind}`),
        style: "destructive",
        onPress: () => run(kind),
      },
    ]);

  const busy = answer.isPending;
  const tapped = answer.variables?.answer;
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

  const cells: {
    key: string;
    label: string;
    strong?: boolean;
    spin?: boolean;
    onPress: () => void;
  }[] = [];
  if (canAnswer && !mine) {
    cells.push(
      {
        key: "decline",
        label: t("offer.decline"),
        spin: tapped === "decline",
        onPress: () => confirm("decline"),
      },
      {
        key: "counter",
        label: t("offer.counter"),
        onPress: () => onCounter(offer),
      },
      {
        key: "accept",
        label: t("offer.accept"),
        strong: true,
        spin: tapped === "accept",
        onPress: () => run("accept"),
      },
    );
  } else if (canAnswer && mine) {
    cells.push({
      key: "withdraw",
      label: t("offer.withdraw"),
      spin: tapped === "withdraw",
      onPress: () => confirm("withdraw"),
    });
  } else if (status === "accepted" && role === "buyer" && !closed) {
    cells.push({
      key: "buy",
      label: t("offer.buyNow", {
        amount: formatMoney(offer.amountMinor, offer.currency),
      }),
      strong: true,
      onPress: () => onBuy(offer),
    });
  }

  return (
    <View
      className={cn(
        "max-w-[76%] overflow-hidden rounded-control",
        cells.length > 0 && "min-w-[64%]",
        mine ? "self-end bg-primary" : "self-start border border-border bg-background",
      )}
      data-conversation={conversationId}
    >
      <View className="gap-px px-md py-sm">
        <View className="flex-row items-baseline gap-sm">
          <Text variant="heading" className={mine ? "text-primary-foreground" : "text-text-1"}>
            {formatMoney(offer.amountMinor, offer.currency)}
          </Text>
          {lower ? (
            <Text
              variant="cardDesc"
              className={cn("line-through", mine ? "text-primary-foreground/60" : "text-text-3")}
            >
              {formatMoney(offer.listingPriceMinor, offer.currency)}
            </Text>
          ) : null}
        </View>
        <Text
          variant="cardDesc"
          className={cn(
            mine ? "text-primary-foreground/80" : status === "accepted" ? "text-success" : "text-text-2",
          )}
        >
          {`${mine ? t("offer.bubble.yours") : t("offer.bubble.theirs")} · ${
            status === "pending"
              ? t(`offer.bubble.pending_${mine ? "mine" : "theirs"}`)
              : t(`chat.offerStatus.${status}`)
          }`}
        </Text>
        {status === "accepted" ? (
          <Text variant="cardDesc" className={mine ? "text-primary-foreground/70" : "text-text-3"}>
            {role === "buyer"
              ? t("offer.bubble.reservedForYou", { time: until })
              : t("offer.bubble.reservedForThem", { time: until })}
          </Text>
        ) : null}
      </View>

      {cells.length > 0 ? (
        <View
          className={cn(
            "flex-row border-t",
            mine ? "border-background/20" : "border-border-subtle",
            busy && "opacity-60",
          )}
        >
          {cells.map((cell, index) => (
            <Pressable
              key={cell.key}
              onPress={cell.onPress}
              disabled={busy}
              role="button"
              accessibilityLabel={cell.label}
              className={cn(
                "h-11 flex-1 items-center justify-center",
                mine ? "active:bg-background/10" : "active:bg-pressed",
                index > 0 && cn("border-s", mine ? "border-background/20" : "border-border-subtle"),
              )}
            >
              {cell.spin && busy ? (
                <ActivityIndicator
                  size="small"
                  color={mine ? colors.onAccent : cell.strong ? colors.accent : colors.text2}
                />
              ) : (
                <Text
                  className={cn(
                    "text-[14px]",
                    mine ? "text-primary-foreground" : cell.strong ? "text-primary" : "text-text-1",
                  )}
                  weight={cell.strong ? 700 : 600}
                >
                  {cell.label}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export { OfferBubble };
