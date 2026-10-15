import { useLocalSearchParams, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { openSearch } from "@/components/search-bar";
import { SearchResults } from "@/components/search-results";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { useSearchStore } from "@/lib/search-store";

/** The item results for the category chosen in Browse, with the filter row and paging. */
export default function BrowseResults() {
  const { t } = useTranslation();
  const router = useRouter();
  const { categoryId, title } = useLocalSearchParams<{ categoryId: string; title: string }>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    useSearchStore.getState().reset("browse", {
      filters: { sort: "newest", categoryId },
      categoryName: title ?? null,
    });
    setReady(true);
  }, [categoryId, title]);

  return (
    <Screen bottomInset={false}>
      <TopBar
        title={title}
        trailing={
          <Pressable
            onPress={() => openSearch(router)}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("browse.search")}
            className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
          >
            <Icon as={Search} size={22} />
          </Pressable>
        }
      />
      {ready ? <SearchResults scope="browse" bottomPadding={16} /> : null}
    </Screen>
  );
}
