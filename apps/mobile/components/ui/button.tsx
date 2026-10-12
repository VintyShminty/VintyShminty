import { cva, type VariantProps } from "class-variance-authority";
import { Pressable } from "react-native";
import { TextStyleContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

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

type ButtonProps = React.ComponentProps<typeof Pressable> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <TextStyleContext.Provider value={{ variant: "button", className: buttonTextVariants({ variant }) }}>
      <Pressable
        className={cn("group", props.disabled && "opacity-40", buttonVariants({ variant, size }), className)}
        role="button"
        {...props}
      />
    </TextStyleContext.Provider>
  );
}

export type { ButtonProps };
export { Button, buttonTextVariants, buttonVariants };
