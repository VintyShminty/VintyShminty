import { type BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { type ReactNode, type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

type NoteSheetProps = {
  ref: Ref<BottomSheetModal>;
  title: string;
  /** A sentence under the title that says what will happen. */
  intro?: string;
  /** Anything extra above the text box, for example the stars of a review. */
  above?: ReactNode;
  label: string;
  placeholder?: string;
  /** The text may not be empty. */
  required?: boolean;
  maxLength: number;
  initialText?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** The confirm button stays off until this is true (for example a star rating was chosen). */
  ready?: boolean;
  loading?: boolean;
  /** Message in red above the button. */
  error?: string | null;
  onSubmit: (text: string) => void;
  onReset?: () => void;
  snapPoints?: string[];
};

/**
 * A sheet with one text box and a confirm button. Cancel an order (reason, optional), open a dispute (details,
 * required), reply to a review, and the comment of a review all use it.
 */
export function NoteSheet({
  ref,
  title,
  intro,
  above,
  label,
  placeholder,
  required,
  maxLength,
  initialText = "",
  confirmLabel,
  destructive,
  ready = true,
  loading,
  error,
  onSubmit,
  onReset,
  snapPoints = ["80%"],
}: NoteSheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);
  const isHe = i18n.language === "he";
  const trimmed = text.trim();

  return (
    <Sheet
      ref={ref}
      title={title}
      snapPoints={snapPoints}
      onChange={(index) => {
        // Opening again starts from the saved text (a reply being edited) or an empty box.
        if (index === 0) setText(initialText);
      }}
      onDismiss={() => {
        setText(initialText);
        onReset?.();
      }}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="gap-lg px-lg pt-sm">
          {intro ? <Text className="text-text-2">{intro}</Text> : null}
          {above}
          <View className="gap-xs">
            <Text variant="bodySmall" weight={500} className="text-text-2">
              {label}
            </Text>
            <View className="min-h-[112px] rounded-control border border-border bg-background px-md py-sm">
              <BottomSheetTextInput
                value={text}
                onChangeText={setText}
                placeholder={placeholder}
                placeholderTextColor={colors.text4}
                selectionColor={colors.accent}
                multiline
                maxLength={maxLength}
                accessibilityLabel={label}
                className={cn(
                  "min-h-[96px] text-body text-text-1",
                  isHe ? "font-heebo-400" : "font-aileron-400",
                )}
                textAlignVertical="top"
                style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
              />
            </View>
            <Text variant="cardDesc" className="self-end text-text-3">
              {text.length}/{maxLength}
            </Text>
          </View>
          {error ? <Banner variant="error">{error}</Banner> : null}
          <Button
            size="lg"
            variant={destructive ? "destructive" : "default"}
            loading={loading}
            disabled={!ready || (required && trimmed === "")}
            onPress={() => onSubmit(trimmed)}
          >
            <Text>{confirmLabel}</Text>
          </Button>
          <Button size="lg" variant="ghost" disabled={loading} onPress={() => dismiss(ref)}>
            <Text>{t("common.cancel")}</Text>
          </Button>
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
}

function dismiss(ref: Ref<BottomSheetModal>) {
  if (ref && typeof ref === "object") ref.current?.dismiss();
}
