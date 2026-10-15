import {
  PLACE_QUERY_MIN,
  type PlaceDetails,
  type PlaceKind,
  type PlaceSuggestion,
  placeDetailsSchema,
  placeSuggestionsSchema,
} from "@vinty/shared";
import { MapPin } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { colors } from "@/theme";

/**
 * City and address suggestions under a text field (Google Places through our server, so the key stays secret).
 * Shows only while the field is focused and something was typed. No suggestions (key off, nothing found, offline)
 * shows nothing and the field works as a plain text field.
 */
export function PlaceSuggestions({
  kind,
  query,
  active,
  onPick,
}: {
  kind: PlaceKind;
  query: string;
  /** True while the field is focused. */
  active: boolean;
  /** Called with the suggestion's main text (city) or the fetched address parts (address). */
  onPick: (picked: { main: string; details: PlaceDetails | null }) => void;
}) {
  const { i18n } = useTranslation();
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  // The value that was just filled in by a pick, so it is not searched for again.
  const picked = useRef<string | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (!active || text.length < PLACE_QUERY_MIN || text === picked.current) {
      setItems([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: text, kind, language: i18n.language });
      api(`/v1/places/suggest?${params}`, { schema: placeSuggestionsSchema })
        .then((r) => {
          if (!stale) setItems(r.suggestions);
        })
        .catch(() => {
          if (!stale) setItems([]);
        });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, kind, active, i18n.language]);

  if (items.length === 0) return null;

  const pick = async (item: PlaceSuggestion) => {
    picked.current = item.main;
    setItems([]);
    if (kind === "city") {
      onPick({ main: item.main, details: null });
      return;
    }
    let details: PlaceDetails | null = null;
    try {
      details = await api(`/v1/places/${encodeURIComponent(item.id)}?language=${i18n.language}`, {
        schema: placeDetailsSchema,
      });
      if (details.line1) picked.current = details.line1;
    } catch {
      // The street is filled in, the person types the rest.
    }
    onPick({ main: item.main, details });
  };

  return (
    <View className="-mt-sm overflow-hidden rounded-control border border-border bg-background">
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => void pick(item)}
          className="flex-row items-center gap-md border-b border-border-subtle px-md py-md active:bg-pressed"
        >
          <Icon as={MapPin} size={20} color={colors.text3} />
          <View className="min-w-0 flex-1">
            <Text variant="body" numberOfLines={1}>
              {item.main}
            </Text>
            {item.secondary ? (
              <Text variant="bodySmall" className="text-text-3" numberOfLines={1}>
                {item.secondary}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
