import { bundleDiscountPercentFor } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Check, Layers } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { BundleSteps } from "@/components/bundle/steps";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { liveBundleItems, type useSellerBundle } from "@/lib/bundle-queries";

/**
 * The Bundle box on the item page, under the seller's card (D-049). Shown for an item on sale that is not yours, and
 * only when the seller's bundles are on. Three states: no bundle yet, a bundle that does not hold this item yet, and
 * this item is in.
 */
function BundleBox({
  sellerId,
  sellerName,
  listingId,
  seller,
}: {
  sellerId: string;
  sellerName: string;
  listingId: string;
  seller: ReturnType<typeof useSellerBundle>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { ladder, bundle, busy, failed, inBundle, add, remove } = seller;
  if (!ladder?.on || ladder.tiers.length === 0) return null;

  const count = liveBundleItems(bundle).length;
  const hasThis = inBundle(listingId);
  const percent = bundle?.discountPercent ?? 0;
  const view = () => router.push({ pathname: "/bundle/[sellerId]", params: { sellerId } });

  let heading = t("bundle.boxTitle", { name: sellerName });
  let line: string | null = null;
  if (bundle && count > 0) {
    if (hasThis) {
      heading = t("bundle.yourBundle");
      line = t(percent > 0 ? "bundle.isInOff" : "bundle.isIn", { count, percent });
    } else {
      line = t(percent > 0 ? "bundle.notInYetOff" : "bundle.notInYet", { count, percent });
    }
  }
  const after = bundleDiscountPercentFor(ladder.tiers, count + 1);
  const addLabel =
    count > 0 && after > percent ? t("bundle.addGain", { percent: after }) : t("bundle.addPlain");

  return (
    <View className="gap-md rounded-control border border-border-subtle p-md">
      <View className="flex-row items-center gap-sm">
        <Icon as={hasThis ? Check : Layers} size={18} className="text-primary" />
        <Text weight={600} numberOfLines={1} className="flex-1">
          {heading}
        </Text>
      </View>
      <BundleSteps tiers={ladder.tiers} count={count} />
      {line ? (
        <Text variant="bodySmall" accessibilityLiveRegion="polite">
          {line}
        </Text>
      ) : (
        <Text variant="bodySmall" className="text-text-3">
          {t("bundle.postageOnce")}
        </Text>
      )}
      {failed ? (
        <Text variant="bodySmall" className="text-error" role="alert">
          {t("bundle.changeFailed")}
        </Text>
      ) : null}
      {hasThis ? (
        <View className="flex-row gap-sm">
          <Button className="flex-1" onPress={view}>
            <Text>{t("bundle.view")}</Text>
          </Button>
          <Button className="flex-1" variant="outline" disabled={busy} onPress={() => remove(listingId)}>
            <Text>{t("bundle.remove")}</Text>
          </Button>
        </View>
      ) : count > 0 ? (
        <View className="gap-sm">
          <Button disabled={busy} onPress={() => add(listingId)}>
            <Text>{addLabel}</Text>
          </Button>
          <Button variant="outline" onPress={view}>
            <Text>{t("bundle.view")}</Text>
          </Button>
        </View>
      ) : (
        <Button disabled={busy} onPress={() => add(listingId)}>
          <Text>{t("bundle.add")}</Text>
        </Button>
      )}
    </View>
  );
}

export { BundleBox };
