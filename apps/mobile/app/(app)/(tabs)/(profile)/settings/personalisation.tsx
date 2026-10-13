import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { type HiddenItem, PERSONALISATION_SIZES_MAX } from "@vinty/shared";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";
import { OptionListSheet } from "@/components/sell/option-list-sheet";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Row, SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { describeApiError } from "@/lib/auth-errors";
import { hiddenQuery, useResetRecommendations, useUndoHide } from "@/lib/feed-queries";
import { personalisationSizesQuery, useSavePersonalisationSizes } from "@/lib/item-queries";
import { useLocalName, useReference } from "@/lib/reference";
import { buildSizeOptions, summariseSizes } from "@/lib/size-options";

/** Settings, Shopping preferences: the sizes your feed puts first. Brands arrive in Milestone 6. */
export default function Personalisation() {
  const { t } = useTranslation();
  const name = useLocalName();
  const sheetRef = useRef<BottomSheetModal>(null);
  const reference = useReference();
  const saved = useQuery(personalisationSizesQuery());
  const save = useSavePersonalisationSizes();
  const hidden = useQuery(hiddenQuery());
  const undo = useUndoHide();
  const reset = useResetRecommendations();
  const [resetDone, setResetDone] = useState(false);

  if (saved.isPending || reference.isPending) {
    return (
      <Screen>
        <TopBar title={t("shopping.title")} />
        <Spinner size="large" />
      </Screen>
    );
  }
  if (saved.isError || reference.isError || !saved.data || !reference.data) {
    return (
      <Screen>
        <TopBar title={t("shopping.title")} />
        <View className="gap-lg px-lg">
          <Banner variant="error">{t("errors.loadFailed")}</Banner>
          <Button
            variant="outline"
            onPress={() => {
              void saved.refetch();
              void reference.refetch();
            }}
          >
            <Text>{t("common.tryAgain")}</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  const options = buildSizeOptions(reference.data.sizeGroups, name);
  const sizeIds = saved.data.sizeIds;
  const summary = summariseSizes(sizeIds, options, {
    none: t("shopping.none"),
    count: (count) => t("shopping.count", { count }),
  });

  const hiddenLabel = (item: HiddenItem) =>
    item.label ?? (item.categoryName ? name(item.categoryName) : t("shopping.hiddenUnknown"));

  const confirmReset = () =>
    Alert.alert(t("shopping.resetTitle"), t("shopping.resetBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("shopping.resetAction"),
        style: "destructive",
        onPress: () => reset.mutate(undefined, { onSuccess: () => setResetDone(true) }),
      },
    ]);

  return (
    <Screen>
      <TopBar title={t("shopping.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        <SectionHeader className="pt-sm">{t("shopping.sizes")}</SectionHeader>
        <Row label={t("shopping.pick")} value={summary} onPress={() => sheetRef.current?.present()} last />
        <Text variant="cardDesc" className="px-lg pt-sm text-text-3">
          {t("shopping.sizesNote")}
        </Text>
        <SectionHeader>{t("shopping.hiddenTitle")}</SectionHeader>
        {hidden.data && hidden.data.items.length > 0 ? (
          hidden.data.items.map((item, i) => (
            <Row
              key={item.id}
              label={hiddenLabel(item)}
              chevron={false}
              last={i === hidden.data.items.length - 1}
              onPress={() => undo.mutate(item.id)}
              trailing={
                <View className="flex-row items-center gap-md">
                  <Text variant="cardDesc" className="text-text-3">
                    {t(`shopping.scope_${item.scope}`)}
                  </Text>
                  <Text variant="bodySmall" weight={600} className="text-primary">
                    {t("shopping.undo")}
                  </Text>
                </View>
              }
            />
          ))
        ) : (
          <Text variant="cardDesc" className="px-lg text-text-3">
            {hidden.isPending ? "" : t("shopping.hiddenNone")}
          </Text>
        )}
        <Text variant="cardDesc" className="px-lg pt-sm text-text-3">
          {t("shopping.hiddenNote")}
        </Text>
        <View className="pt-xl">
          <Row
            label={t("shopping.resetTitle")}
            onPress={confirmReset}
            disabled={reset.isPending}
            chevron={false}
            last
          />
        </View>
        {resetDone ? (
          <View className="px-lg pt-lg">
            <Banner variant="success">{t("shopping.resetDone")}</Banner>
          </View>
        ) : null}
        {reset.isError ? (
          <View className="px-lg pt-lg">
            <Banner variant="error">{t("errors.general")}</Banner>
          </View>
        ) : null}
        {save.isError ? (
          <View className="px-lg pt-lg">
            <Banner variant="error">{t(describeApiError(save.error).key)}</Banner>
          </View>
        ) : null}
      </ScrollView>
      <OptionListSheet
        ref={sheetRef}
        title={t("shopping.sizes")}
        options={options}
        mode="multi"
        max={PERSONALISATION_SIZES_MAX}
        selected={sizeIds}
        onChange={(ids) => save.mutate(ids)}
        header={
          <Text variant="bodySmall" className="text-text-3">
            {t("shopping.max", { count: PERSONALISATION_SIZES_MAX })}
          </Text>
        }
      />
    </Screen>
  );
}
