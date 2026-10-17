import {
  attributeMode,
  conditionWords,
  findCategory,
  LISTING_TITLE_MAX,
  type ReferenceData,
  sizeOptionsFor,
} from "@vinty/shared";
import { Check, Trash2, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { UploadTile } from "@/components/admin-upload/upload-tile";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PickerRow } from "@/components/ui/picker-row";
import { Text } from "@/components/ui/text";
import { itemProblems, missingFieldNames, type UploadItem, type UploadPhoto } from "@/lib/admin-upload";
import { useLocalName } from "@/lib/reference";
import { cn } from "@/lib/utils";

export type PickerKind = "category" | "size" | "condition" | "brand" | "colours";

type ItemCardProps = {
  item: UploadItem;
  index: number;
  reference: ReferenceData;
  /** The chosen category as a path in the app language. */
  categoryLabel: string | null;
  onEdit: (patch: Partial<UploadItem>) => void;
  onOpenPicker: (kind: PickerKind) => void;
  onRemovePhoto: (photoId: string) => void;
  onRetryPhoto: (photo: UploadPhoto) => void;
  onDelete: () => void;
};

const STRIP_TILE = 72;

/**
 * One item of the batch: a title with its photo count, a strip of the photos that belong together, and compact
 * rows for what the listing rules need. It says "Ready" or what is missing, and keeps the server's answer after posting.
 */
function ItemCard({
  item,
  index,
  reference,
  categoryLabel,
  onEdit,
  onOpenPicker,
  onRemovePhoto,
  onRetryPhoto,
  onDelete,
}: ItemCardProps) {
  const { t } = useTranslation();
  const name = useLocalName();
  const posted = item.state === "published";
  const locked = posted || item.state === "publishing";
  const problems = itemProblems(item, reference);
  const missing = missingFieldNames(problems);
  const ready = !problems.any;

  const category = item.categoryId ? findCategory(reference.categories, item.categoryId) : null;
  const mode = (field: "brand" | "size" | "condition" | "colour") => attributeMode(category, field);
  const sizeLabel = sizeOptionsFor(reference, category).find((s) => s.id === item.sizeId)?.label;
  const condition = reference.conditions.find((c) => c.id === item.conditionId);
  const conditionName = condition ? name(conditionWords(condition, category).name) : "";
  const colourNames = item.colourIds
    .map((id) => name(reference.colours.find((c) => c.id === id)?.name))
    .filter(Boolean)
    .join(", ");

  const suggested = (on: boolean, label: string) =>
    on ? `${label} (${t("adminUpload.item.suggested")})` : label;
  const fieldError = (field: string) => {
    const key = item.failedFields?.[field];
    return key ? t(key, { defaultValue: "" }) || undefined : undefined;
  };
  const missingText = missing.map((f) => t(`adminUpload.fields.${f}`)).join(", ");

  const status = posted ? (
    <Badge variant="success" icon={Check} label={t("adminUpload.item.posted")} />
  ) : item.state === "failed" ? (
    <Badge variant="error" icon={TriangleAlert} label={t("adminUpload.item.failed")} />
  ) : ready ? (
    <Badge variant="success" icon={Check} label={t("adminUpload.item.ready")} />
  ) : null;

  return (
    <View
      className={cn(
        "gap-md rounded-window border border-border-subtle bg-background p-md",
        posted && "opacity-70",
      )}
    >
      <View className="flex-row items-center gap-sm">
        <View className="flex-1">
          <Text variant="heading" accessibilityRole="header">
            {t("adminUpload.item.title", { n: index + 1 })}
          </Text>
          <Text variant="cardMeta">{t("adminUpload.item.photoCount", { count: item.photos.length })}</Text>
        </View>
        {status}
        {!locked ? (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("adminUpload.item.delete")}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-pressed"
          >
            <Icon as={Trash2} size={20} className="text-text-2" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm">
        {item.photos.map((photo, i) => (
          <UploadTile
            key={photo.id}
            photo={photo}
            size={STRIP_TILE}
            accessibilityLabel={t("adminUpload.photos.number", { n: i + 1 })}
            onPress={photo.state === "failed" ? () => onRetryPhoto(photo) : undefined}
            onRemove={locked ? undefined : () => onRemovePhoto(photo.id)}
          />
        ))}
      </ScrollView>

      {posted ? null : (
        <>
          {item.state === "failed" && item.error ? <Banner variant="error">{item.error}</Banner> : null}
          {item.suggestion === "loading" ? (
            <Text variant="cardMeta">{t("adminUpload.item.reading")}</Text>
          ) : null}

          <Input
            label={t("adminUpload.fields.title")}
            value={item.title}
            onChangeText={(title) => onEdit({ title })}
            maxLength={LISTING_TITLE_MAX}
            editable={!locked}
            error={fieldError("title")}
            returnKeyType="done"
          />
          <PickerRow
            label={suggested(item.suggested.category, t("adminUpload.fields.categoryId"))}
            value={categoryLabel}
            onPress={() => onOpenPicker("category")}
            disabled={locked}
            error={fieldError("categoryId")}
          />
          {category && mode("size") !== "hidden" ? (
            <PickerRow
              label={t("adminUpload.fields.sizeId")}
              value={sizeLabel}
              onPress={() => onOpenPicker("size")}
              disabled={locked}
              error={fieldError("sizeId")}
            />
          ) : null}
          {category && mode("condition") !== "hidden" ? (
            <PickerRow
              label={t("adminUpload.fields.conditionId")}
              value={conditionName}
              onPress={() => onOpenPicker("condition")}
              disabled={locked}
              error={fieldError("conditionId")}
            />
          ) : null}
          {category && mode("brand") !== "hidden" ? (
            <PickerRow
              label={suggested(item.suggested.brand, t("adminUpload.fields.brandId"))}
              value={item.brandText.trim() || null}
              onPress={() => onOpenPicker("brand")}
              disabled={locked}
              error={fieldError("brandId")}
            />
          ) : null}
          {category && mode("colour") !== "hidden" ? (
            <PickerRow
              label={suggested(item.suggested.colours, t("adminUpload.fields.colourIds"))}
              value={colourNames}
              onPress={() => onOpenPicker("colours")}
              disabled={locked}
              error={fieldError("colourIds")}
            />
          ) : null}
          <Input
            label={t("adminUpload.fields.priceMinor")}
            prefix="₪"
            placeholder="0"
            keyboardType="decimal-pad"
            selectTextOnFocus
            value={item.priceText}
            onChangeText={(priceText) => onEdit({ priceText: priceText.replace(/[^\d.,]/g, "") })}
            maxLength={9}
            editable={!locked}
            error={fieldError("priceMinor")}
          />

          {!ready && item.state !== "failed" ? (
            <Text variant="bodySmall" className="text-warning">
              {problems.photos === "uploading"
                ? t("adminUpload.item.uploading")
                : t("adminUpload.item.missing", { fields: missingText })}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

export { ItemCard };
