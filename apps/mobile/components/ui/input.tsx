import { Eye, EyeOff } from "lucide-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { inputDirectionStyle } from "@/lib/rtl";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

type InputProps = Omit<React.ComponentProps<typeof TextInput>, "placeholderTextColor"> & {
  label: string;
  /** Message under the field. Turns the outline red. */
  error?: string;
  /** Quiet help under the field, replaced by the error when there is one. */
  hint?: string;
  /** Something small at the trailing end of the field, for example a count. */
  footerEnd?: string;
  /** Fixed text before the value, for example the currency sign. */
  prefix?: string;
  /** Adds a show/hide button. */
  secureToggle?: { show: string; hide: string };
  containerClassName?: string;
  /** Something small at the end of the label line, for example the "Use it" chip. */
  labelEnd?: React.ReactNode;
  /** Inside a bottom sheet pass the sheet's own text box, so the sheet lifts above the keyboard. */
  inputComponent?: React.ElementType;
};

/**
 * Labelled text box (docs/components.md, TextField). 48 tall, 12 radius, 16px text so iOS does not zoom.
 * States: default, focused (espresso outline), error (red outline plus message), disabled.
 */
function Input({
  label,
  error,
  hint,
  footerEnd,
  prefix,
  secureToggle,
  containerClassName,
  labelEnd,
  inputComponent: Field = TextInput,
  className,
  editable = true,
  multiline,
  secureTextEntry,
  ref,
  ...props
}: InputProps & { ref?: React.Ref<TextInput> }) {
  const { i18n } = useTranslation();
  const isHe = i18n.language === "he";
  const [focused, setFocused] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const isSecure = Boolean(secureTextEntry) && !revealed;
  // Follows what is typed, so Hebrew in an English app runs right to left (and the other way round).
  const direction = inputDirectionStyle(props.value ?? props.defaultValue, isHe);

  return (
    <View className={cn("gap-xs", containerClassName)}>
      {labelEnd ? (
        <View className="flex-row items-center justify-between gap-sm">
          <Text variant="bodySmall" weight={500} className="text-text-2">
            {label}
          </Text>
          {labelEnd}
        </View>
      ) : (
        <Text variant="bodySmall" weight={500} className="text-text-2">
          {label}
        </Text>
      )}
      <View
        className={cn(
          "flex-row items-center rounded-control border bg-background px-md",
          multiline ? "min-h-[112px] items-start py-sm" : "h-12",
          error ? "border-error" : focused ? "border-primary" : "border-border",
          !editable && "bg-surface opacity-60",
        )}
      >
        {prefix ? (
          <Text className="me-xs text-text-2" weight={600}>
            {prefix}
          </Text>
        ) : null}
        <Field
          ref={ref}
          editable={editable}
          multiline={multiline}
          secureTextEntry={isSecure}
          placeholderTextColor={colors.text4}
          selectionColor={colors.accent}
          accessibilityLabel={label}
          onFocus={(e: Parameters<NonNullable<React.ComponentProps<typeof TextInput>["onFocus"]>>[0]) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e: Parameters<NonNullable<React.ComponentProps<typeof TextInput>["onFocus"]>>[0]) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          className={cn(
            // One line: no lineHeight (iOS clips the bottoms of g, y, p when a single-line box has one). Several lines need it.
            multiline ? "text-body" : "text-[16px]",
            "flex-1 text-text-1",
            isHe ? "font-heebo-400" : "font-aileron-400",
            direction.textAlign === "right" ? "text-right" : "text-left",
            multiline && "min-h-[96px] pt-xs",
            className,
          )}
          textAlignVertical={multiline ? "top" : "center"}
          style={{
            ...direction,
            paddingHorizontal: 0,
          }}
          {...props}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            role="button"
            accessibilityLabel={revealed ? secureToggle.hide : secureToggle.show}
            className="ms-sm h-8 w-8 items-center justify-center"
          >
            <Icon as={revealed ? EyeOff : Eye} size={20} className="text-text-3" />
          </Pressable>
        ) : null}
      </View>
      {error || hint || footerEnd ? (
        <View className="flex-row justify-between gap-md">
          <Text
            variant="cardDesc"
            className={cn("flex-1", error ? "text-error" : "text-text-3")}
            accessibilityLiveRegion={error ? "polite" : undefined}
          >
            {error ?? hint ?? ""}
          </Text>
          {footerEnd ? (
            <Text variant="cardDesc" className="text-text-3">
              {footerEnd}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export type { InputProps };
export { Input };
