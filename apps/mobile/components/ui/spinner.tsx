import { ActivityIndicator, View } from "react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

/** A quiet loading indicator in the accent colour. */
function Spinner({ className, size = "small" }: { className?: string; size?: "small" | "large" }) {
  return (
    <View className={cn("items-center justify-center py-xl", className)} accessibilityRole="progressbar">
      <ActivityIndicator size={size} color={colors.accent} />
    </View>
  );
}

export { Spinner };
