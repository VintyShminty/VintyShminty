import { Eye, EyeOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, TextInput, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
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
  /** Adds a show/hide button. */
  secureToggle?: { show: string; hide: string };
  containerClassName?: string;
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
  secureToggle,
  containerClassName,
  className,
  editable = true,
  multiline,
  secureTextEntry,
  ref,
  ...props
}: InputProps & { ref?: React.Ref<TextInput> }) {
  const [focused, setFocused] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const isSecure = Boolean(secureTextEntry) && !revealed;

  return (
    <View className={cn("gap-xs", containerClassName)}>
      <Text variant="bodySmall" weight={500} className="text-text-2">
        {label}
      </Text>
      <View
        className={cn(
          "flex-row items-center rounded-control border bg-background px-md",
          multiline ? "min-h-[112px] items-start py-sm" : "h-12",
          error ? "border-error" : focused ? "border-primary" : "border-border",
          !editable && "bg-surface opacity-60",
        )}
      >
        <TextInput
          ref={ref}
          editable={editable}
          multiline={multiline}
          secureTextEntry={isSecure}
          placeholderTextColor={colors.text4}
          selectionColor={colors.accent}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          className={cn(
            "flex-1 text-start font-aileron-400 text-body text-text-1 rtl:font-heebo-400",
            multiline && "min-h-[96px] pt-xs",
            className,
          )}
          textAlignVertical={multiline ? "top" : "center"}
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
