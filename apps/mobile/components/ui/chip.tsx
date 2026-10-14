import type { LucideIcon } from "lucide-react-native";
import { Pressable } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text, TextStyleContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type ChipProps = Omit<React.ComponentProps<typeof Pressable>, "children"> & {
  label: string;
  /** Shown after a dot separator, for example "All · 19". */
  count?: number;
  selected?: boolean;
  /** A small icon before the label. */
  icon?: LucideIcon;
};

// D-008: 32px tall, 14px side padding, fully rounded, 1px outline in text-4 on white.
// Active: filled espresso with white text.
function Chip({ label, count, selected = false, icon, className, disabled, ...props }: ChipProps) {
  const text = count === undefined ? label : `${label} · ${count}`;
  return (
    <TextStyleContext.Provider
      value={{ variant: "pill", className: selected ? "text-primary-foreground" : "text-text-1" }}
    >
      <Pressable
        role="button"
        accessibilityState={{ selected, disabled: !!disabled }}
        disabled={disabled}
        className={cn(
          "h-8 shrink-0 flex-row items-center justify-center gap-xs rounded-full border px-[14px]",
          selected ? "border-primary bg-primary" : "border-text-4 bg-background active:bg-pressed",
          disabled && "opacity-40",
          className,
        )}
        {...props}
      >
        {icon ? <Icon as={icon} size={13} /> : null}
        <Text>{text}</Text>
      </Pressable>
    </TextStyleContext.Provider>
  );
}

export type { ChipProps };
export { Chip };
