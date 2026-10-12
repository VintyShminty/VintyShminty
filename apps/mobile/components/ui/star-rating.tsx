import { Star } from "lucide-react-native";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { colors } from "@/theme";

/** Five stars, filled for the rating (rounded to the nearest whole star). Filled only for ratings (docs/components.md, Icon). */
function StarRating({ rating, size = 14 }: { rating: number | null; size?: number }) {
  const filled = rating === null ? 0 : Math.round(rating);
  return (
    <View className="flex-row gap-px" accessibilityRole="image" accessibilityLabel={`${rating ?? 0} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          as={Star}
          size={size}
          strokeWidth={1.5}
          className={n <= filled ? "text-primary" : "text-text-4"}
          fill={n <= filled ? colors.accent : "none"}
        />
      ))}
    </View>
  );
}

export { StarRating };
