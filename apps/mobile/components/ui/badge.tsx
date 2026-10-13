import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text, TextStyleContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

// No self-alignment here on purpose: in a row the parent centres it, in a column the caller adds self-start.
// D-008: 22px tall outline pill on a white fill, 1px outline in the status colour, icon plus label.
const badgeVariants = cva(
  "h-[22px] shrink-0 flex-row items-center justify-center gap-xs rounded-full border bg-background px-sm",
  {
    variants: {
      variant: {
        accent: "border-primary",
        success: "border-success",
        warning: "border-warning",
        error: "border-error",
        neutral: "border-text-2",
      },
    },
    defaultVariants: { variant: "accent" },
  },
);

const badgeTextVariants = cva("", {
  variants: {
    variant: {
      accent: "text-primary",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      neutral: "text-text-2",
    },
  },
  defaultVariants: { variant: "accent" },
});

type BadgeProps = React.ComponentProps<typeof View> &
  VariantProps<typeof badgeVariants> & {
    /** Status is never colour alone: an icon is always shown. */
    icon: LucideIcon;
    label: string;
  };

function Badge({ className, variant, icon, label, ...props }: BadgeProps) {
  return (
    <TextStyleContext.Provider value={{ variant: "badge", className: badgeTextVariants({ variant }) }}>
      <View className={cn(badgeVariants({ variant }), className)} {...props}>
        <Icon as={icon} size={11} />
        <Text>{label}</Text>
      </View>
    </TextStyleContext.Provider>
  );
}

export type { BadgeProps };
export { Badge, badgeTextVariants, badgeVariants };
