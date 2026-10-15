import { ArrowUp, HandCoins, ImagePlus } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { sendTyping } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

const TYPING_IDLE_MS = 3000;

/**
 * The box at the bottom of a chat (docs/components.md, MessageComposer): photo button, a text box that grows up to
 * about five lines, and a send button that is grey until there is something to send. It sits on the home indicator
 * when the keyboard is down and right above the keyboard when it is up.
 */
function Composer({
  conversationId,
  onSend,
  onPickPhoto,
  onOffer,
}: {
  conversationId: string;
  onSend: (text: string) => void;
  onPickPhoto: () => void;
  /** The buyer's way to make an offer from the chat. Left out for the seller and for items that cannot take offers. */
  onOffer?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const [text, setText] = useState("");
  const input = useRef<TextInput>(null);
  const typing = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isHe = i18n.language === "he";
  const canSend = text.trim().length > 0;

  const stopTyping = () => {
    clearTimeout(idle.current);
    if (typing.current) sendTyping(conversationId, false);
    typing.current = false;
  };
  // Leaving the chat or switching to another one: say we stopped.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the chat changes
  useEffect(() => stopTyping, [conversationId]);

  const onChange = (value: string) => {
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

  return (
    <View className="border-t border-border-subtle bg-background">
      <View
        className="flex-row items-end gap-sm bg-background px-md pt-sm"
        style={{ paddingBottom: keyboardVisible ? 8 : insets.bottom + 8 }}
      >
        <Pressable
          onPress={onPickPhoto}
          hitSlop={6}
          role="button"
          accessibilityLabel={t("chat.addPhoto")}
          className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
        >
          <Icon as={ImagePlus} size={24} className="text-text-2" />
        </Pressable>
        {onOffer ? (
          <Pressable
            onPress={onOffer}
            hitSlop={6}
            role="button"
            accessibilityLabel={t("offer.title")}
            className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
          >
            <Icon as={HandCoins} size={24} className="text-text-2" />
          </Pressable>
        ) : null}
        <View className="min-h-11 flex-1 justify-center rounded-bar border border-border bg-surface px-md">
          <TextInput
            ref={input}
            value={text}
            onChangeText={onChange}
            onBlur={stopTyping}
            placeholder={t("chat.composerPlaceholder")}
            placeholderTextColor={colors.text4}
            selectionColor={colors.accent}
            accessibilityLabel={t("chat.composerPlaceholder")}
            multiline
            maxLength={4000}
            className={cn(
              "max-h-[120px] py-sm text-body text-text-1",
              isHe ? "font-heebo-400" : "font-aileron-400",
            )}
            style={{
              textAlign: isHe ? "right" : "left",
              writingDirection: isHe ? "rtl" : "ltr",
              paddingHorizontal: 0,
            }}
          />
        </View>
        <Pressable
          onPress={send}
          disabled={!canSend}
          hitSlop={6}
          role="button"
          accessibilityLabel={t("chat.send")}
          accessibilityState={{ disabled: !canSend }}
          className={cn(
            "h-11 w-11 items-center justify-center rounded-full",
            canSend ? "bg-primary active:opacity-90" : "bg-pressed",
          )}
        >
          <Icon as={ArrowUp} size={22} className={canSend ? "text-primary-foreground" : "text-text-4"} />
        </Pressable>
      </View>
    </View>
  );
}

export { Composer };
