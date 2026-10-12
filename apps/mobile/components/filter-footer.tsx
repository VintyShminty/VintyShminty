import { useQuery } from "@tanstack/react-query";
import { SEARCH_TOTAL_CAP } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { searchCountQuery } from "@/lib/discovery-queries";
import { activeFilters, type Scope, useSearchStore } from "@/lib/search-store";

/** The sticky "Show N results" button at the bottom of the filter panel. The number is live (docs/design.md, D-014). */
export function FilterFooter({ scope, closes = 1 }: { scope: Scope; closes?: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useSearchStore((s) => s.scopes[scope]);
  const count = useQuery(searchCountQuery(activeFilters(state)));
  const total = count.data;
  const label = !total
    ? t("filters.showResults")
    : total.totalCapped
      ? t("filters.showResultsCapped", { count: SEARCH_TOTAL_CAP })
      : t("filters.showResultsCount", { count: total.total });
  return (
    <View
      className="border-t border-border-subtle bg-background px-lg pt-md"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <Button size="lg" onPress={() => router.dismiss(closes)} accessibilityLabel={label}>
        <Text>{label}</Text>
      </Button>
    </View>
  );
}
