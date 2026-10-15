import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import {
  attributeMode,
  categoryTrail,
  findCategory,
  LISTING_COLOURS_MAX,
  LISTING_DESCRIPTION_MAX,
  LISTING_TITLE_MAX,
  type ListingField,
  listingLimits,
  mergeGuesses,
  type SellGuesses,
  stripHiddenAttributes,
  validateListing,
} from "@vinty/shared";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PricePill } from "@/components/price-pill";
import { BrandSheet } from "@/components/sell/brand-sheet";
import { ColourGridSheet } from "@/components/sell/colour-grid-sheet";
import { ConditionSlider } from "@/components/sell/condition-slider";
import { type Option, OptionListSheet } from "@/components/sell/option-list-sheet";
import { ParcelSizes } from "@/components/sell/parcel-sizes";
import { PhotoTips } from "@/components/sell/photo-tips";
import { PhotoUploader } from "@/components/sell/photo-uploader";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { PickerRow } from "@/components/ui/picker-row";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { describeApiError } from "@/lib/auth-errors";
import { categoryGuesses } from "@/lib/category-guesses";
import { formatMoney, priceTextToMinor } from "@/lib/money";
import { ownListingQuery, pricePreviewQuery, useSaveListing } from "@/lib/queries";
import { useLocalName, useReference } from "@/lib/reference";
import { currentGuesses, usePhotoAssist, usePhotoTipCheck, useTextAssist } from "@/lib/sell-assist";
import { toListingInput, useSellStore } from "@/lib/sell-store";

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-md pt-xl">
      <Text variant="sectionLabel" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** "Buyer pays ₪126 incl. Buyer Protection", worked out by the server from the fee rule. */
function BuyerPricePreview({ priceMinor }: { priceMinor: number | null }) {
  const { t } = useTranslation();
  const debounced = useDebounced(priceMinor);
  const preview = useQuery({
    ...pricePreviewQuery(debounced ?? 0),
    enabled: debounced !== null && debounced > 0,
  });
  if (priceMinor === null || priceMinor <= 0 || !preview.data) return null;
  return (
    <View className="gap-xs">
      <PricePill
        className="self-start"
        amountMinor={preview.data.buyerPriceMinor}
        currency={preview.data.currency}
      />
      <Text variant="cardDesc">{t("sell.buyerPays")}</Text>
    </View>
  );
}

/**
 * The sell form (spec, Sell form): photos, title and description, the category and the rows it asks for, price with
 * the buyer price, parcel size, then Save draft and Upload. The same screen edits a listing or resumes a draft.
 */
export default function SellForm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useLocalName();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const reference = useReference();
  const existing = useQuery({ ...ownListingQuery(id ?? ""), enabled: Boolean(id) });
  const save = useSaveListing();

  const values = useSellStore((s) => s.values);
  const errors = useSellStore((s) => s.errors);
  const status = useSellStore((s) => s.status);
  const listingId = useSellStore((s) => s.listingId);
  const photoSuggestion = useSellStore((s) => s.suggestion);
  const textSuggestion = useSellStore((s) => s.textSuggestion);
  const suggestion = mergeGuesses(photoSuggestion, textSuggestion);
  const { set, setErrors, clearError, start } = useSellStore.getState();
  const [banner, setBanner] = useState<string | null>(null);
  const [ready, setReady] = useState(!id);
  // The pickers show the helper's guesses as they were when the picker opened, so an open list never jumps.
  const [shown, setShown] = useState<SellGuesses | null>(null);

  // Start fresh for a new listing, or fill the form from the saved listing.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    if (!id) {
      start();
      started.current = true;
    } else if (existing.data) {
      start(existing.data);
      started.current = true;
      setReady(true);
    }
  }, [id, existing.data, start]);

  // A new listing starts with the first parcel size (Small), tagged Recommended (spec, Shipping).
  const firstParcel = reference.data?.parcelSizes[0]?.id;
  useEffect(() => {
    if (id || !firstParcel) return;
    useSellStore.setState((s) =>
      s.values.parcelSizeId ? s : { values: { ...s.values, parcelSizeId: firstParcel } },
    );
  }, [id, firstParcel]);

  // Reads the first photos in the background (new listings only). Nothing is filled in: the guesses show first in the
  // pickers the seller goes through anyway.
  const assistLanguage = i18n.language === "he" ? "he" : "en";
  usePhotoAssist({ enabled: !id, language: assistLanguage, reference: reference.data });
  // Photos added later are checked for tips, and the title and description are read when the seller leaves them.
  usePhotoTipCheck({ enabled: !id });
  const readWords = useTextAssist({ enabled: !id, language: assistLanguage });

  const brandRef = useRef<BottomSheetModal>(null);
  const sizeRef = useRef<BottomSheetModal>(null);
  const colourRef = useRef<BottomSheetModal>(null);
  const materialRef = useRef<BottomSheetModal>(null);

  // Android back asks the same question as the close cross, so typed work is never lost without asking. Only while
  // the form itself is showing: the category panels pushed on top handle back themselves.
  const closeRef = useRef<() => void>(() => router.back());
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        closeRef.current();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const ref = reference.data;
  if (!ref || !ready) {
    return (
      <Screen>
        <TopBar leading="close" title={t("sell.title")} />
        {reference.isError || existing.isError ? (
          <View className="px-lg">
            <Banner variant="error">{t("errors.loadFailed")}</Banner>
          </View>
        ) : (
          <Spinner size="large" />
        )}
      </Screen>
    );
  }

  const limits = listingLimits(ref);
  const category = values.categoryId ? findCategory(ref.categories, values.categoryId) : null;
  const trail = values.categoryId ? categoryTrail(ref.categories, values.categoryId) : [];
  const mode = (field: Parameters<typeof attributeMode>[1]) => attributeMode(category, field);
  const editingLive = Boolean(listingId) && status !== "draft";
  const err = (field: ListingField) => {
    const key = errors[field];
    if (!key) return undefined;
    return t(key, { min: formatMoney(limits.minPriceMinor, "ILS"), max: limits.maxPhotos });
  };

  // While no category is chosen, the top guess shows quietly on the row ("Boots?"). It opens the panels, nothing is picked.
  const topGuess = values.categoryId
    ? undefined
    : categoryGuesses(suggestion, ref.categories, ["designer"])[0]?.node;
  const categoryHint = topGuess ? t("sell.assist.guess", { name: name(topGuess.name) }) : undefined;

  // While no condition is chosen, the words' guess shows as a chip above the slider. Tapping it picks it.
  const conditionGuess = values.conditionId
    ? undefined
    : ref.conditions.find((c) => c.id === suggestion?.conditionId);

  const sizeOptions: Option[] = (() => {
    if (!category) return [];
    const groups = ref.sizeGroups.filter((g) => category.sizeGroupIds.includes(g.id));
    return groups.flatMap((g) =>
      g.sizes.map((s, i) => ({ id: s.id, label: name(s.name), section: i === 0 ? name(g.name) : undefined })),
    );
  })();
  const sizeLabel = sizeOptions.find((o) => o.id === values.sizeId)?.label;
  const colourNames = values.colourIds
    .map((cid) => name(ref.colours.find((c) => c.id === cid)?.name))
    .filter(Boolean)
    .join(", ");
  const material = ref.materials.find((m) => m.id === values.materialId);
  const recommendedParcel = category?.defaultParcelSizeId ?? ref.parcelSizes[0]?.id ?? null;
  const priceMinor = priceTextToMinor(values.priceText);
  const uploading = values.photos.some((p) => p.state === "uploading");

  const close = () => router.back();

  /** Saves. `publish` runs the full check first, the same rules the server runs. */
  const submit = async (publish: boolean) => {
    setBanner(null);
    if (uploading) {
      setBanner(t("sell.waitForPhotos"));
      return;
    }
    const cleaned = stripHiddenAttributes(
      {
        ...values,
        brandId: values.brand?.id ?? null,
        brandName: values.brand && !values.brand.id ? values.brand.name : null,
        priceMinor,
        photoCount: values.photos.filter((p) => p.state === "done").length,
      },
      category,
    );
    const found = validateListing(cleaned, ref, { publish: publish || editingLive });
    if (values.priceText.trim() !== "" && priceMinor === null)
      found.priceMinor = "validation.listing.price.required";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setBanner(t("sell.checkFields"));
      return false;
    }
    try {
      const saved = await save.mutateAsync({
        id: listingId,
        input: toListingInput({
          ...values,
          brand: cleaned.brandId || cleaned.brandName ? values.brand : null,
        }),
        publish,
      });
      useSellStore.setState({ dirty: false });
      if (publish) {
        // Close the form and land on the new listing's own page.
        router.dismissAll();
        router.push({ pathname: "/listing/[id]", params: { id: saved.id } });
      } else {
        // A saved draft or an edit: back to where the form was opened (the listing page shows the change).
        router.back();
      }
      return true;
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) setErrors(error.fields);
      setBanner(t(describeApiError(error).key));
      return false;
    }
  };

  const onClose = () => {
    if (!useSellStore.getState().dirty) {
      close();
      return;
    }
    Alert.alert(t("sell.closeTitle"), undefined, [
      { text: t("sell.closeSave"), onPress: () => void submit(false) },
      { text: t("sell.closeDiscard"), style: "destructive", onPress: close },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };
  closeRef.current = onClose;

  const openSheet = (sheet: React.RefObject<BottomSheetModal | null>) => {
    setShown(currentGuesses());
    sheet.current?.present();
  };

  return (
    <Screen bottomInset={false}>
      <TopBar leading="close" onBack={onClose} title={editingLive ? t("sell.editTitle") : t("sell.title")} />
      <ScreenScroll contentContainerClassName="pb-lg">
        <Section title={t("sell.photos.title")}>
          <PhotoUploader maxPhotos={limits.maxPhotos} error={err("photos")} />
          <PhotoTips />
          {/* The "made or touched up with AI" checkbox (values.usedAiPhotos, t("sell.aiPhotos")) is hidden for now.
              The field and the server support stay, it simply stays false until the row comes back. */}
        </Section>

        <Section title={t("sell.about")}>
          <Input
            label={t("sell.titleLabel")}
            placeholder={t("sell.titlePlaceholder")}
            value={values.title}
            onChangeText={(title) => {
              set({ title });
              clearError("title");
            }}
            maxLength={LISTING_TITLE_MAX}
            footerEnd={`${values.title.length}/${LISTING_TITLE_MAX}`}
            error={err("title")}
            returnKeyType="next"
            onBlur={readWords}
          />
          <Input
            label={t("sell.descriptionLabel")}
            placeholder={t("sell.descriptionPlaceholder")}
            value={values.description}
            onChangeText={(description) => {
              set({ description });
              clearError("description");
            }}
            multiline
            maxLength={LISTING_DESCRIPTION_MAX}
            footerEnd={`${values.description.length}/${LISTING_DESCRIPTION_MAX}`}
            error={err("description")}
            onBlur={readWords}
          />
        </Section>

        <Section title={t("sell.details")}>
          <PickerRow
            label={t("sell.category")}
            value={trail.length ? name(trail.at(-1)?.name) : null}
            onPress={() => router.push({ pathname: "/sell-form/category", params: { depth: "1" } })}
            error={err("categoryId")}
            hint={categoryHint}
          />
          {category && mode("brand") !== "hidden" ? (
            <PickerRow
              label={t("sell.brand")}
              value={values.brand?.name}
              onPress={() => openSheet(brandRef)}
              error={err("brandId")}
            />
          ) : null}
          {category && mode("size") !== "hidden" ? (
            <PickerRow
              label={t("sell.size")}
              value={sizeLabel}
              onPress={() => openSheet(sizeRef)}
              error={err("sizeId")}
            />
          ) : null}
          {category && mode("condition") !== "hidden" ? (
            <View className="gap-sm">
              <Text variant="smallLabel" weight={600}>
                {t("sell.condition")}
              </Text>
              {conditionGuess ? (
                <Chip
                  className="self-start"
                  icon={Sparkles}
                  label={t("sell.assist.guessName", { name: name(conditionGuess.name) })}
                  onPress={() => {
                    set({ conditionId: conditionGuess.id });
                    clearError("conditionId");
                  }}
                />
              ) : null}
              <ConditionSlider
                stops={ref.conditions.map((c) => ({
                  id: c.id,
                  label: name(c.name),
                  description: name(c.description),
                }))}
                value={values.conditionId}
                onChange={(conditionId) => {
                  set({ conditionId });
                  clearError("conditionId");
                }}
                error={err("conditionId")}
              />
            </View>
          ) : null}
          {category && mode("colour") !== "hidden" ? (
            <PickerRow
              label={t("sell.colours")}
              value={colourNames}
              onPress={() => openSheet(colourRef)}
              error={err("colourIds")}
            />
          ) : null}
          {category && mode("material") !== "hidden" ? (
            <PickerRow
              label={mode("material") === "optional" ? t("sell.materialRecommended") : t("sell.material")}
              value={name(material?.name)}
              onPress={() => openSheet(materialRef)}
              error={err("materialId")}
            />
          ) : null}
        </Section>

        <Section title={t("sell.pricing")}>
          <Input
            label={t("sell.price")}
            prefix="₪"
            placeholder="0"
            keyboardType="decimal-pad"
            selectTextOnFocus
            value={values.priceText}
            onChangeText={(priceText) => {
              set({ priceText: priceText.replace(/[^\d.,]/g, "") });
              clearError("priceMinor");
            }}
            error={err("priceMinor")}
            maxLength={9}
          />
          <BuyerPricePreview priceMinor={priceMinor} />
        </Section>

        <Section title={t("sell.shipping")}>
          <ParcelSizes
            sizes={ref.parcelSizes}
            selected={values.parcelSizeId}
            recommended={recommendedParcel}
            onSelect={(parcelSizeId) => {
              set({ parcelSizeId, parcelChosen: true });
              clearError("parcelSizeId");
            }}
            error={err("parcelSizeId")}
          />
          <Text variant="cardDesc" className="text-text-3">
            {t("sell.buyerPaysPostage")}
          </Text>
        </Section>
      </ScreenScroll>

      <View
        className="gap-sm border-t border-border-subtle bg-background px-lg pt-md"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        {banner && (banner !== t("sell.checkFields") || Object.keys(errors).length > 0) ? (
          <Banner variant="error">{banner}</Banner>
        ) : null}
        {editingLive ? (
          <Button size="lg" loading={save.isPending} onPress={() => void submit(false)}>
            <Text>{t("sell.saveChanges")}</Text>
          </Button>
        ) : (
          <View className="flex-row gap-sm">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={save.isPending}
              onPress={() => void submit(false)}
            >
              <Text>{t("sell.saveDraft")}</Text>
            </Button>
            <Button size="lg" className="flex-1" loading={save.isPending} onPress={() => void submit(true)}>
              <Text>{t("sell.upload")}</Text>
            </Button>
          </View>
        )}
      </View>

      <BrandSheet
        ref={brandRef}
        selected={values.brand}
        fromTag={shown?.brand}
        fromSource={shown?.brandSource}
        onChange={(brand) => {
          set({ brand });
          clearError("brandId");
        }}
      />
      <OptionListSheet
        ref={sizeRef}
        title={t("sell.size")}
        mode="single"
        options={sizeOptions}
        selected={values.sizeId ? [values.sizeId] : []}
        clearable={mode("size") === "optional"}
        header={<Banner variant="info">{t("sell.sizeHint")}</Banner>}
        onChange={([sizeId]) => {
          set({ sizeId: sizeId ?? null });
          clearError("sizeId");
        }}
      />
      <ColourGridSheet
        ref={colourRef}
        title={t("sell.colours")}
        max={LISTING_COLOURS_MAX}
        options={ref.colours.map((c) => ({
          id: c.id,
          label: name(c.name),
          en: c.name.en,
          swatch: c.swatchHex,
        }))}
        selected={values.colourIds}
        suggestedIds={shown?.colourIds}
        header={
          <Text variant="bodySmall" className="text-text-3">
            {t("sell.coloursHint", { max: LISTING_COLOURS_MAX })}
          </Text>
        }
        onChange={(colourIds) => {
          set({ colourIds });
          clearError("colourIds");
        }}
      />
      <OptionListSheet
        ref={materialRef}
        title={t("sell.material")}
        mode="single"
        options={ref.materials.map((m) => ({ id: m.id, label: name(m.name) }))}
        selected={values.materialId ? [values.materialId] : []}
        clearable={mode("material") === "optional"}
        onChange={([materialId]) => {
          set({ materialId: materialId ?? null });
          clearError("materialId");
        }}
      />
    </Screen>
  );
}
