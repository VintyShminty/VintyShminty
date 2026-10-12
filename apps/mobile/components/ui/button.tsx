import { cva, type VariantProps } from "class-variance-authority";
import { ActivityIndicator, Pressable } from "react-native";
import { TextStyleContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

// Restyled to docs/design.md: 12px radius, no shadows, espresso primary, hairline outlines.
const buttonVariants = cva("shrink-0 flex-row items-center justify-center gap-sm rounded-control", {
  variants: {
    variant: {
      default: "bg-primary active:opacity-90",
      outline: "border border-primary bg-background active:bg-pressed",
      ghost: "border border-border bg-transparent active:border-text-3 active:bg-surface",
      secondary: "bg-surface active:bg-pressed",
      destructive: "bg-destructive active:opacity-90",
      link: "",
    },
    size: {
      default: "h-10 px-lg",
      lg: "h-12 px-xl",
      sm: "h-8 px-md",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

// Colour of the label and icons inside the button.
const buttonTextVariants = cva("", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      outline: "text-primary",
      ghost: "text-text-2 group-active:text-text-1",
      secondary: "text-text-1",
      destructive: "text-destructive-foreground",
      link: "text-primary underline",
    },
  },
  defaultVariants: { variant: "default" },
});

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner next to the label and ignores presses until it is false again. */
    loading?: boolean;
  };

const SPINNER_COLOR = {
  default: colors.onAccent,
  destructive: colors.onAccent,
  outline: colors.accent,
  ghost: colors.text2,
  secondary: colors.text1,
  link: colors.accent,
} as const;

function Button({ className, variant, size, loading = false, children, disabled, ...props }: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  return (
    <TextStyleContext.Provider value={{ variant: "button", className: buttonTextVariants({ variant }) }}>
      <Pressable
        className={cn(
          "group",
          isDisabled && !loading && "opacity-40",
          buttonVariants({ variant, size }),
          className,
        )}
        role="button"
        disabled={isDisabled}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        {...props}
      >
        {(state) => (
          <>
            {loading ? <ActivityIndicator size="small" color={SPINNER_COLOR[variant ?? "default"]} /> : null}
            {typeof children === "function" ? children(state) : children}
          </>
        )}
      </Pressable>
    </TextStyleContext.Provider>
  );
}

export type { ButtonProps };
export { Button, buttonTextVariants, buttonVariants };
