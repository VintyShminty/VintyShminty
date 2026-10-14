"use client";

import { type InfiniteData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FeedCard,
  findCategory,
  hiddenItemSchema,
  type ListingCard,
  referenceDataSchema,
} from "@vinty/shared";
import { EyeOff, Layers, MoreHorizontal, Tag, UserX } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clientApi } from "@/lib/api-client";
import { isolate } from "@/lib/bidi";

type Page = { items: ListingCard[]; nextCursor: string | null };
const WIDTH = 300;
const GAP = 4;

/** The sentence for a reason: its kind plus the name where there is one ("You like Zara"). Same words as the app. */
function useReasonText() {
  const { t, i18n } = useTranslation();
  const hebrew = i18n.language === "he";
  return (reason: FeedCard["reason"]): string => {
    if (!reason) return t("feedWhy.reasons.none");
    const name = reason.name ? isolate(reason.name[hebrew ? "he" : "en"], hebrew) : "";
    return name
      ? t(`feedWhy.reasons.${reason.kind}`, { name })
      : t(`feedWhy.reasons.${reason.kind}NoName`, { defaultValue: t(`feedWhy.reasons.${reason.kind}`) });
  };
}

/**
 * "Why you see this" and Not interested (D-022): a small "..." button on a Home card for logged in people. It opens a
 * popover next to the button that says why the card is there, then offers Hide this item, Hide everything from the
 * seller, Show less of the brand and Show less of the category (only the ones that apply). The card leaves the list at
 * once. The popover closes on a click outside, Escape, scrolling or resizing.
 */
export function FeedMenu({ card }: { card: FeedCard }) {
  const { t, i18n } = useTranslation();
  const hebrew = i18n.language === "he";
  const queryClient = useQueryClient();
  const reasonText = useReasonText();
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => setPlace(null), []);
  const open = place !== null;

  const toggle = () => {
    if (open) return close();
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(WIDTH, window.innerWidth - 32);
    // Under the button, lined up with its end edge, and never outside the window.
    const end = hebrew ? rect.left : rect.right;
    const left = hebrew ? end : end - width;
    setPlace({ top: rect.bottom + GAP, left: Math.max(16, Math.min(left, window.innerWidth - width - 16)) });
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const reference = useQuery({
    queryKey: ["reference"],
    queryFn: () => clientApi("/v1/reference", { schema: referenceDataSchema, lang: i18n.language }),
    enabled: open && Boolean(card.categoryId),
    staleTime: 3_600_000,
  });
  const category =
    card.categoryId && reference.data
      ? (findCategory(reference.data.categories, card.categoryId) ?? null)
      : null;
  const brand = card.brandId && card.brandName ? { id: card.brandId, name: card.brandName } : null;
  const seller = card.seller ?? null;

  const hide = useMutation({
    mutationFn: (input: { scope: "item" | "seller" | "brand" | "category"; targetId: string }) =>
      clientApi("/v1/feed/hide", { method: "POST", body: input, schema: hiddenItemSchema }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["feed-hidden"] }),
  });

  const notInterested = (
    scope: "item" | "seller" | "brand" | "category",
    targetId: string,
    matches: (c: ListingCard) => boolean,
  ) => {
    close();
    // The cards leave every Home list in memory at once, nothing else moves.
    queryClient.setQueriesData<InfiniteData<Page>>({ queryKey: ["grid", "feed"] }, (data) =>
      data
        ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((c) => !matches(c)) })) }
        : data,
    );
    hide.mutate({ scope, targetId });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={t("feedWhy.action")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="absolute end-sm top-sm z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background text-text-1 hover:bg-pressed"
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {open ? (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label={t("feedWhy.title")}
          style={{
            position: "fixed",
            top: place.top,
            left: place.left,
            width: `min(${WIDTH}px, calc(100vw - 32px))`,
          }}
          className="z-50 rounded-control border border-border-subtle bg-background py-sm text-start"
        >
          <div className="flex flex-col gap-xs px-md pb-sm pt-xs">
            <p className="text-section-label font-bold uppercase text-text-3">{t("feedWhy.title")}</p>
            <p className="text-body font-semibold text-text-1">{reasonText(card.reason)}</p>
            <p className="truncate text-body-sm text-text-3">{card.title}</p>
          </div>
          <p className="border-t border-border-subtle px-md pb-xs pt-md text-section-label font-bold uppercase text-text-3">
            {t("feedWhy.notInterested")}
          </p>
          <Action
            icon={<EyeOff size={18} aria-hidden />}
            onClick={() => notInterested("item", card.id, (c) => c.id === card.id)}
          >
            {t("feedWhy.hideItem")}
          </Action>
          {seller ? (
            <Action
              icon={<UserX size={18} aria-hidden />}
              onClick={() => notInterested("seller", seller.id, (c) => c.seller?.id === seller.id)}
            >
              {seller.username
                ? t("feedWhy.hideSeller", { name: isolate(seller.username, hebrew) })
                : t("feedWhy.hideSellerNoName")}
            </Action>
          ) : null}
          {brand ? (
            <Action
              icon={<Tag size={18} aria-hidden />}
              onClick={() =>
                notInterested("brand", brand.id, (c) => c.id === card.id || c.brandId === brand.id)
              }
            >
              {t("feedWhy.hideBrand", { name: isolate(brand.name, hebrew) })}
            </Action>
          ) : null}
          {category ? (
            <Action
              icon={<Layers size={18} aria-hidden />}
              onClick={() =>
                notInterested(
                  "category",
                  category.id,
                  (c) => c.id === card.id || c.categoryId === category.id,
                )
              }
            >
              {t("feedWhy.hideCategory", { name: isolate(category.name[hebrew ? "he" : "en"], hebrew) })}
            </Action>
          ) : null}
          <p className="px-md pb-xs pt-sm text-card-desc text-text-3">{t("feedWhy.note")}</p>
        </div>
      ) : null}
    </>
  );
}

function Action({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-md px-md text-start text-body-sm text-text-1 hover:bg-pressed"
    >
      <span className="shrink-0 text-text-3">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
