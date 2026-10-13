import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { PERSONALISATION_SIZES_MAX } from "@vinty/shared";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { type Option, OptionListSheet } from "@/components/sell/option-list-sheet";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Row, SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { describeApiError } from "@/lib/auth-errors";
import { personalisationSizesQuery, useSavePersonalisationSizes } from "@/lib/item-queries";
import { useLocalName, useReference } from "@/lib/reference";

/** Settings, Shopping preferences: the sizes your feed puts first. Brands arrive in Milestone 6. */
export default function Personalisation() {
  const { t } = useTranslation();
  const name = useLocalName();
  const sheetRef = useRef<BottomSheetModal>(null);
  const reference = useReference();
  const saved = useQuery(personalisationSizesQuery());
  const save = useSavePersonalisationSizes();

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

  // Every size of every group, with the group name as the heading (Clothing, Shoes and so on).
  const options: Option[] = reference.data.sizeGroups.flatMap((group) =>
    group.sizes.map((size, i) => ({
      id: size.id,
      label: name(size.name),
      section: i === 0 ? name(group.name) : undefined,
    })),
  );
  const sizeIds = saved.data.sizeIds;
  const summary =
    sizeIds.length === 0
      ? t("shopping.none")
      : sizeIds.length <= 3
        ? sizeIds
            .map((id) => options.find((o) => o.id === id)?.label)
            .filter(Boolean)
            .join(", ")
        : t("shopping.count", { count: sizeIds.length });

  return (
    <Screen>
      <TopBar title={t("shopping.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        <SectionHeader className="pt-sm">{t("shopping.sizes")}</SectionHeader>
        <Row label={t("shopping.pick")} value={summary} onPress={() => sheetRef.current?.present()} last />
        <Text variant="cardDesc" className="px-lg pt-sm text-text-3">
          {t("shopping.sizesNote")}
        </Text>
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
