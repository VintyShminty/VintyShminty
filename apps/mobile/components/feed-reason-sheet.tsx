import { type BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { type FeedCard, findCategory } from "@vinty/shared";
import { EyeOff, Layers, Tag, UserX } from "lucide-react-native";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Row, SectionHeader } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { isolate } from "@/lib/bidi";
import { useHideFromFeed } from "@/lib/feed-queries";
import { useLocalName, useReference } from "@/lib/reference";

/** The sentence for a reason: its kind plus the name where there is one ("You like Zara"). */
function useReasonText() {
  const { t, i18n } = useTranslation();
  const localName = useLocalName();
  return (reason: FeedCard["reason"]): string => {
    if (!reason) return t("feedWhy.reasons.none");
    const name = reason.name ? isolate(localName(reason.name), i18n.language === "he") : "";
    return name
      ? t(`feedWhy.reasons.${reason.kind}`, { name })
      : t(`feedWhy.reasons.${reason.kind}NoName`, { defaultValue: t(`feedWhy.reasons.${reason.kind}`) });
  };
}

/**
 * "Why you see this" (docs/components.md, FeedReasonSheet): opened by a long press on a Home card. It says why the
 * card is there in plain words, then offers Not interested for this item, this seller, this brand or this category
 * (only the ones that apply). The card leaves the list at once.
 */
function FeedReasonSheet({ ref, card }: { ref: Ref<BottomSheetModal>; card: FeedCard | null }) {
  const { t, i18n } = useTranslation();
  const hebrew = i18n.language === "he";
  const insets = useSafeAreaInsets();
  const localName = useLocalName();
  const reasonText = useReasonText();
  const hide = useHideFromFeed();
  const reference = useReference();

  const close = () => (typeof ref === "object" && ref ? ref.current?.dismiss() : undefined);
  const brand = card?.brandId && card.brandName ? { id: card.brandId, name: card.brandName } : null;
  const category =
    card?.categoryId && reference.data
      ? (findCategory(reference.data.categories, card.categoryId) ?? null)
      : null;
  const seller = card?.seller ?? null;

  const notInterested = (scope: "item" | "seller" | "brand" | "category") => {
    if (!card) return;
    close();
    if (scope === "item") {
      hide.mutate({ input: { scope, targetId: card.id }, matches: (c) => c.id === card.id });
    } else if (scope === "seller" && seller) {
      hide.mutate({ input: { scope, targetId: seller.id }, matches: (c) => c.seller?.id === seller.id });
    } else if (scope === "brand" && brand) {
      hide.mutate({
        input: { scope, targetId: brand.id },
        matches: (c) => c.id === card.id || c.brandId === brand.id,
      });
    } else if (scope === "category" && category) {
      hide.mutate({
        input: { scope, targetId: category.id },
        matches: (c) => c.id === card.id || c.categoryId === category.id,
      });
    }
  };

  return (
    <Sheet ref={ref} title={t("feedWhy.title")} snapPoints={["58%"]}>
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {card ? (
          <>
            <View className="gap-xs px-lg pt-sm">
              <Text variant="heading">{reasonText(card.reason)}</Text>
              <Text variant="bodySmall" className="text-text-3" numberOfLines={1}>
                {card.title}
              </Text>
            </View>
            <SectionHeader>{t("feedWhy.notInterested")}</SectionHeader>
            <Row
              icon={EyeOff}
              label={t("feedWhy.hideItem")}
              onPress={() => notInterested("item")}
              chevron={false}
              last={!seller && !brand && !category}
            />
            {seller ? (
              <Row
                icon={UserX}
                label={
                  seller.username
                    ? t("feedWhy.hideSeller", { name: isolate(seller.username, hebrew) })
                    : t("feedWhy.hideSellerNoName")
                }
                onPress={() => notInterested("seller")}
                chevron={false}
                last={!brand && !category}
              />
            ) : null}
            {brand ? (
              <Row
                icon={Tag}
                label={t("feedWhy.hideBrand", { name: isolate(brand.name, hebrew) })}
                onPress={() => notInterested("brand")}
                chevron={false}
                last={!category}
              />
            ) : null}
            {category ? (
              <Row
                icon={Layers}
                label={t("feedWhy.hideCategory", { name: isolate(localName(category.name), hebrew) })}
                onPress={() => notInterested("category")}
                chevron={false}
                last
              />
            ) : null}
            <Text variant="cardDesc" className="px-lg pt-md text-text-3">
              {t("feedWhy.note")}
            </Text>
          </>
        ) : null}
      </BottomSheetScrollView>
    </Sheet>
  );
}

export { FeedReasonSheet, useReasonText };
