import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import { ListingGrid } from "@/components/listing-grid";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { favouritesQuery } from "@/lib/item-queries";
import { colors } from "@/theme";

/** Waits until typing pauses before searching. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Everything you hearted, with a search box. Sold items stay, with the green Sold band (spec, Favourites). */
export default function Favourites() {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const query = useInfiniteQuery(favouritesQuery(q));
  const isHe = i18n.language === "he";

  return (
    <Screen>
      <TopBar title={t("favourites.title")} />
      <View className="px-lg pb-md">
        <View className="h-11 flex-row items-center gap-sm rounded-bar border border-border bg-surface px-md">
          <Icon as={Search} size={18} className="text-text-3" />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("favourites.search")}
            placeholderTextColor={colors.text4}
            selectionColor={colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t("favourites.search")}
            className={`flex-1 text-body text-text-1 ${isHe ? "font-heebo-400" : "font-aileron-400"}`}
            style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
          />
          {text ? (
            <Pressable
              onPress={() => setText("")}
              hitSlop={8}
              role="button"
              accessibilityLabel={t("common.close")}
            >
              <Icon as={X} size={18} className="text-text-3" />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ListingGrid
        query={query}
        heartOnSold
        emptyTitle={q ? t("favourites.noMatches") : t("favourites.empty")}
        emptyMessage={q ? undefined : t("favourites.emptyNote")}
      />
    </Screen>
  );
}
