import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useSearchStore } from "@/lib/search-store";

/** Opens a fresh search (the words and filters start empty). */
export function openSearch(router: ReturnType<typeof useRouter>) {
  useSearchStore.getState().reset("search");
  router.push("/search");
}

/** The big rounded search box on Home and Browse. Tapping it opens the Search screen (docs/components.md, SearchBar). */
export function SearchBar() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => openSearch(router)}
      role="button"
      accessibilityLabel={t("search.placeholder")}
      className="h-11 flex-row items-center gap-sm rounded-bar border border-border bg-surface px-md active:border-text-3"
    >
      <Icon as={Search} size={18} className="text-text-3" />
      <Text className="flex-1 text-text-4">{t("search.placeholder")}</Text>
    </Pressable>
  );
}
