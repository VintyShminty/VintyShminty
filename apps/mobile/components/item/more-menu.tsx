import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Flag, MoreHorizontal } from "lucide-react-native";
import { type Ref, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReportSheet } from "@/components/item/report-sheet";
import { Icon } from "@/components/ui/icon";
import { Row } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";

type MoreMenuProps = {
  targetType: "listing" | "user";
  targetId: string;
  /** Label of the Report row, for example "Report this item". */
  reportLabel: string;
};

/**
 * The "..." button in a top bar and the small menu it opens (docs/components.md, ActionMenu).
 * Today the menu has Report. The report sheet opens right after the menu closes.
 */
function MoreMenu({ targetType, targetId, reportLabel }: MoreMenuProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const menuRef = useRef<BottomSheetModal>(null);
  const reportRef = useRef<BottomSheetModal>(null);

  return (
    <>
      <Pressable
        onPress={() => menuRef.current?.present()}
        hitSlop={8}
        role="button"
        accessibilityLabel={t("item.more")}
        className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
      >
        <Icon as={MoreHorizontal} size={22} />
      </Pressable>
      <MenuSheet ref={menuRef} title={t("item.more")}>
        <View style={{ paddingBottom: insets.bottom + 16 }}>
          <Row
            icon={Flag}
            label={reportLabel}
            destructive
            last
            chevron={false}
            onPress={() => {
              menuRef.current?.dismiss();
              // Wait for the menu to slide away before the next sheet comes up.
              setTimeout(() => reportRef.current?.present(), 250);
            }}
          />
        </View>
      </MenuSheet>
      <ReportSheet ref={reportRef} targetType={targetType} targetId={targetId} />
    </>
  );
}

function MenuSheet({
  ref,
  title,
  children,
}: {
  ref: Ref<BottomSheetModal>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet ref={ref} title={title} snapPoints={[200]}>
      {children}
    </Sheet>
  );
}

export { MoreMenu };
