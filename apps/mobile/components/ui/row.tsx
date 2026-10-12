import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ForwardIcon } from "@/components/ui/top-bar";
import { cn } from "@/lib/utils";

/** Small grey label above a group of rows (docs/design.md, Section header). */
function SectionHeader({ children, className }: { children: string; className?: string }) {
  return (
    <Text variant="sectionLabel" className={cn("px-lg pb-sm pt-xl", className)} accessibilityRole="header">
      {children}
    </Text>
  );
}

type RowProps = {
  label: string;
  icon?: LucideIcon;
  /** Grey value at the end of the row, for example the current language. */
  value?: string;
  /** Anything custom at the end of the row. Replaces the value. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Hides the line under the row (last row of a group). */
  last?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** Shows a forward arrow. Defaults to true when the row can be pressed. */
  chevron?: boolean;
};

/** A settings row: label, optional value, forward arrow, hairline underneath. About 58px tall, as in the spec. */
function Row({ label, icon, value, trailing, onPress, last, destructive, disabled, chevron }: RowProps) {
  const body = (
    <View
      className={cn(
        "min-h-[58px] flex-row items-center gap-md px-lg",
        !last && "border-b border-border-subtle",
      )}
    >
      {icon ? (
        <Icon as={icon} size={20} className={destructive ? "text-destructive" : "text-text-2"} />
      ) : null}
      <Text weight={500} className={cn("flex-1 py-md", destructive && "text-destructive")}>
        {label}
      </Text>
      {trailing ??
        (value ? (
          <Text variant="bodySmall" className="max-w-[55%] text-text-3" numberOfLines={1}>
            {value}
          </Text>
        ) : null)}
      {(chevron ?? Boolean(onPress)) ? <ForwardIcon /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      className={cn("active:bg-surface", disabled && "opacity-40")}
    >
      {body}
    </Pressable>
  );
}

/** A row with a switch at the end. The whole row toggles. */
function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  last,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onCheckedChange(!checked)}
      role="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      className={cn("active:bg-surface", disabled && "opacity-40")}
    >
      <View
        className={cn(
          "min-h-[58px] flex-row items-center gap-md px-lg py-sm",
          !last && "border-b border-border-subtle",
        )}
      >
        <View className="flex-1">
          <Text weight={500}>{label}</Text>
          {description ? (
            <Text variant="cardDesc" className="mt-xs text-text-3">
              {description}
            </Text>
          ) : null}
        </View>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          accessibilityLabel={label}
        />
      </View>
    </Pressable>
  );
}

export { Row, SectionHeader, SwitchRow };
