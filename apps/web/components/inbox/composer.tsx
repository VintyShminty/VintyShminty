"use client";

import { ArrowUp, HandCoins, ImagePlus } from "lucide-react";
import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sendTyping } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const TYPING_IDLE_MS = 3000;

/**
 * The box at the bottom of a chat: a photo button, a text box that grows up to about six lines (Enter sends,
 * Shift+Enter starts a new line) and a send button that is grey until there is something to send.
 */
export function Composer({
  conversationId,
  onSend,
  onPickPhoto,
  onOffer,
}: {
  conversationId: string;
  onSend: (text: string) => void;
  onPickPhoto: (file: File) => void;
  /** The buyer's way to make an offer from the chat. Left out for the seller and for items that cannot take offers. */
  onOffer?: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const typing = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canSend = text.trim().length > 0;

  const stopTyping = () => {
    clearTimeout(idle.current);
    if (typing.current) sendTyping(conversationId, false);
    typing.current = false;
  };
  // Leaving the chat or switching to another one: say we stopped.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the chat changes
  useEffect(() => stopTyping, [conversationId]);

  // The box grows with the text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: text is what changes the height
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    if (value.trim() === "") return stopTyping();
    if (!typing.current) {
      typing.current = true;
      sendTyping(conversationId, true);
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const send = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    stopTyping();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while choosing a character with an input method (Hebrew keyboards, emoji pickers) must not send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const picked = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (chosen) onPickPhoto(chosen);
  };

  return (
    <div className="border-t border-border-subtle bg-background">
      <div className="flex items-end gap-sm px-md py-sm">
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={picked}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => file.current?.click()}
          aria-label={t("chat.addPhoto")}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-pressed"
        >
          <ImagePlus size={24} aria-hidden />
        </button>
        {onOffer ? (
          <button
            type="button"
            onClick={onOffer}
            aria-label={t("offer.title")}
            title={t("offer.title")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-pressed"
          >
            <HandCoins size={24} aria-hidden />
          </button>
        ) : null}
        <div className="flex min-h-11 flex-1 items-center rounded-bar border border-border bg-surface px-md focus-within:border-primary">
          <textarea
            ref={box}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={stopTyping}
            rows={1}
            maxLength={4000}
            dir="auto"
            placeholder={t("chat.composerPlaceholder")}
            aria-label={t("chat.composerPlaceholder")}
            className="block max-h-36 w-full resize-none bg-transparent py-sm text-body text-text-1 outline-none placeholder:text-text-3"
          />
        </div>
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label={t("chat.send")}
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            canSend ? "bg-primary text-on-accent hover:opacity-90" : "bg-pressed text-text-4",
          )}
        >
          <ArrowUp size={22} aria-hidden />
        </button>
      </div>
    </div>
  );
}
