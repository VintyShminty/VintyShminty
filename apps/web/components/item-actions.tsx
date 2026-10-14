"use client";

import { formatPrice, messagePageSchema } from "@vinty/shared";
import { Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppOnlyNotice } from "@/components/app-only-notice";
import { useLoginPrompt } from "@/components/login-prompt";
import { OfferDialog } from "@/components/offer/offer-dialog";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { useStartConversation } from "@/lib/messaging-queries";
import { useSendOffer } from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";

type BuyProps = {
  listingId: string;
  lang: string;
  reserved: boolean;
  canBuy: boolean;
  canOffer: boolean;
  /** The listed price (before Covered), the offer rules compare against it. */
  priceMinor: number;
  buyerPriceMinor: number;
  currency: string;
  /** The chat the viewer already has about this item, if any. */
  conversationId: string | null;
};

/** Logged out, the buttons that need an account open the login prompt. Reports still say they work in the app. */
function useGate() {
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const [showNotice, notice] = useAppOnlyNotice();
  return { gate: () => (viewer ? showNotice() : ask()), notice };
}

/**
 * Buy and "Or make your price" (D-019, row 8). Logged out they open the login prompt. Buying goes to checkout (an item
 * held for you after an accepted offer is bought at that offer's price). Making your price opens the offer dialog, then
 * sends the offer into the chat about this item (made first when there is none) and opens that chat.
 */
export function BuyButtons({
  listingId,
  lang,
  reserved,
  canBuy,
  canOffer,
  priceMinor,
  buyerPriceMinor,
  currency,
  conversationId,
  compact = false,
}: BuyProps & { compact?: boolean }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const router = useRouter();
  const startChat = useStartConversation();
  const sendOffer = useSendOffer();
  const [offerOpen, setOfferOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  const buy = async () => {
    if (!viewer) return ask();
    if (buying) return;
    setBuying(true);
    try {
      if (reserved && conversationId) {
        const page = await clientApi(`/v1/conversations/${conversationId}/messages?limit=30`, {
          schema: messagePageSchema,
        }).catch(() => null);
        const accepted = page?.items.find(
          (m) => m.offer?.status === "accepted" && new Date(m.offer.expiresAt).getTime() > Date.now(),
        );
        if (accepted?.offer) {
          router.push(`/${lang}/checkout?offer=${accepted.offer.id}`);
          return;
        }
      }
      router.push(`/${lang}/checkout?listing=${listingId}`);
    } finally {
      setBuying(false);
    }
  };

  const makeOffer = async (amountMinor: number) => {
    const chatId = conversationId ?? (await startChat.mutateAsync(listingId)).id;
    await sendOffer.mutateAsync({ conversationId: chatId, amountMinor });
    router.push(`/${lang}/inbox/${chatId}`);
  };
  const openOffer = () => (viewer ? setOfferOpen(true) : ask());

  return (
    <div className="flex flex-col gap-sm">
      {canBuy ? (
        <button
          type="button"
          onClick={() => void buy()}
          disabled={buying}
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
        >
          {reserved ? t("item.buyNow") : t("item.buyFor", { amount: formatPrice(buyerPriceMinor, currency) })}
        </button>
      ) : null}
      {canOffer ? (
        canBuy ? (
          <button
            type="button"
            onClick={openOffer}
            className={cn(
              "self-center rounded-control px-sm text-body-sm font-semibold text-primary underline-offset-4 hover:underline",
              compact ? "py-px" : "py-xs",
            )}
          >
            {t("item.orMakeYourPrice")}
          </button>
        ) : (
          <button
            type="button"
            onClick={openOffer}
            className="inline-flex h-12 w-full items-center justify-center rounded-control border border-primary px-lg text-body font-semibold text-primary hover:bg-accent-tint"
          >
            {t("item.orMakeYourPrice")}
          </button>
        )
      ) : null}
      {canOffer && viewer ? (
        <OfferDialog
          open={offerOpen}
          mode="make"
          listingPriceMinor={priceMinor}
          currency={currency}
          showQuota
          onSend={makeOffer}
          onClose={() => setOfferOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** The bar fixed to the bottom of a phone screen (hidden on a laptop, where the card holds the buttons). */
export function BuyBar(props: BuyProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-lg pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-md lg:hidden">
      <BuyButtons {...props} compact />
    </div>
  );
}

/**
 * The Message chip on the seller row. Logged out: login prompt. Logged in: opens the chat about this item (the one
 * you already have, or a new one) and goes there.
 */
export function MessageChip({
  sellerName,
  listingId,
  lang,
}: {
  sellerName: string;
  listingId: string;
  lang: string;
}) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const router = useRouter();
  const start = useStartConversation();
  const [failure, setFailure] = useState({ title: "", body: "" });
  const [showFailure, failureNotice] = useAppOnlyNotice(failure);

  const onClick = () => {
    if (!viewer) return ask();
    if (start.isPending) return;
    start.mutate(listingId, {
      onSuccess: (chat) => router.push(`/${lang}/inbox/${chat.id}`),
      onError: (error) => {
        const code = error instanceof ApiClientError ? error.code : null;
        setFailure({
          title: t("web.inbox.startFailedTitle"),
          body:
            code === "blocked"
              ? t("chat.blockedSend")
              : code === "listing_unavailable"
                ? t("web.inbox.startUnavailable")
                : code === "forbidden"
                  ? t("web.inbox.startOwn")
                  : t("web.inbox.startFailed"),
        });
        showFailure();
      },
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={start.isPending}
        aria-label={`${t("item.messageSeller")}: ${sellerName}`}
        className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-text-4 bg-background px-[14px] text-pill text-text-1 hover:bg-pressed disabled:opacity-60"
      >
        {t("item.message")}
      </button>
      {failureNotice}
    </>
  );
}

/** "Report this item" or "Report this seller": a small link at the foot of the page. */
export function ReportButton({ label }: { label: string }) {
  const { gate, notice } = useGate();
  return (
    <>
      <button
        type="button"
        onClick={gate}
        className="inline-flex items-center gap-xs rounded-control py-xs text-body-sm text-text-3 underline-offset-4 hover:text-text-1 hover:underline"
      >
        <Flag size={14} aria-hidden />
        {label}
      </button>
      {notice}
    </>
  );
}
