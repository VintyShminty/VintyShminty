import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Check, MapPin, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { EmptyState, ListSkeleton, LoadError } from "@/components/orders/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { addressesQuery, useDeleteAddress } from "@/lib/orders-queries";

/** The delivery addresses saved on this account (Settings). */
export default function Addresses() {
  const { t } = useTranslation();
  const router = useRouter();
  const query = useQuery(addressesQuery());
  const remove = useDeleteAddress();
  const rows = query.data ?? [];

  const confirmDelete = (id: string) =>
    Alert.alert(t("address.deleteTitle"), t("address.deleteNote"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("address.delete"), style: "destructive", onPress: () => remove.mutate(id) },
    ]);

  return (
    <Screen>
      <TopBar title={t("address.title")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-2xl">
        {query.isPending ? (
          <ListSkeleton rows={3} />
        ) : query.isError && rows.length === 0 ? (
          <LoadError onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={t("address.emptyTitle")} note={t("address.emptyNote")} />
        ) : (
          rows.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push({ pathname: "/settings/addresses/[id]", params: { id: a.id } })}
              role="button"
              accessibilityLabel={`${a.label ?? a.fullName}, ${a.line1}, ${a.city}`}
              className="flex-row items-center gap-md border-b border-border-subtle px-lg py-md active:bg-surface"
            >
              <Icon as={MapPin} size={20} className="text-text-2" />
              <View className="flex-1 gap-xs">
                <View className="flex-row items-center gap-sm">
                  <Text weight={600} numberOfLines={1} className="shrink">
                    {a.label || a.fullName}
                  </Text>
                  {a.isDefault ? <Badge variant="neutral" icon={Check} label={t("address.default")} /> : null}
                </View>
                {a.label ? (
                  <Text variant="bodySmall" className="text-text-3" numberOfLines={1}>
                    {a.fullName}
                  </Text>
                ) : null}
                <Text variant="bodySmall" className="text-text-3" numberOfLines={1}>
                  {[a.line1, a.line2].filter(Boolean).join(" ")}
                </Text>
                <Text variant="bodySmall" className="text-text-3" numberOfLines={1}>
                  {a.postcode} {a.city}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmDelete(a.id)}
                hitSlop={8}
                role="button"
                accessibilityLabel={t("address.delete")}
                className="px-sm py-xs"
              >
                <Text variant="bodySmall" weight={600} className="text-destructive">
                  {t("address.delete")}
                </Text>
              </Pressable>
              <ForwardIcon />
            </Pressable>
          ))
        )}
        <View className="px-lg pt-xl">
          <Button
            size="lg"
            variant="outline"
            disabled={rows.length >= 10}
            onPress={() => router.push("/settings/addresses/new")}
          >
            <Icon as={Plus} size={18} className="text-primary" />
            <Text>{t("address.add")}</Text>
          </Button>
          {rows.length >= 10 ? (
            <Text variant="cardDesc" className="mt-sm text-center text-text-3">
              {t("address.limit")}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
