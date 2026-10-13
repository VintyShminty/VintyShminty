import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { colors } from "@/theme";

/** Five big stars to tap. The chosen number and every star before it are filled. */
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row justify-center gap-sm" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={4}
          role="radio"
          accessibilityState={{ checked: n === value }}
          accessibilityLabel={t("review.stars", { count: n })}
          className="p-xs"
        >
          <Icon
            as={Star}
            size={36}
            strokeWidth={1.5}
            className={n <= value ? "text-primary" : "text-text-4"}
            fill={n <= value ? colors.accent : "none"}
          />
        </Pressable>
      ))}
    </View>
  );
}
