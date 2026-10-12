import { AlertCircle, CheckCircle2, Info } from "lucide-react-native";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const STYLES = {
  info: { box: "border-border bg-accent-tint", text: "text-primary", icon: Info },
  error: { box: "border-error bg-error-tint", text: "text-error", icon: AlertCircle },
  success: { box: "border-success bg-success-tint", text: "text-success", icon: CheckCircle2 },
} as const;

/** Message strip for page level news: a failed log in, a saved change. Always icon plus words, never colour alone. */
function Banner({
  variant = "info",
  children,
  className,
}: {
  variant?: keyof typeof STYLES;
  children: string;
  className?: string;
}) {
  const style = STYLES[variant];
  return (
    <View
      className={cn("flex-row items-start gap-sm rounded-control border p-md", style.box, className)}
      accessibilityRole={variant === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
    >
      <Icon as={style.icon} size={18} className={cn("mt-px", style.text)} />
      <Text variant="bodySmall" className={cn("flex-1", style.text)}>
        {children}
      </Text>
    </View>
  );
}

export { Banner };
