import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type TabsProps<K extends string> = {
  items: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
};

/** Text tabs with an espresso underline on the active one (Profile: Listings, Reviews, About). */
function Tabs<K extends string>({ items, value, onChange, className }: TabsProps<K>) {
  return (
    <View className={cn("flex-row border-b border-border-subtle", className)} role="tablist">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            role="tab"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center"
          >
            <View
              className={cn(
                "-mb-px border-b-2 px-md py-md",
                active ? "border-primary" : "border-transparent",
              )}
            >
              <Text
                variant="bodySmall"
                weight={active ? 700 : 500}
                className={active ? "text-primary" : "text-text-3"}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export { Tabs };
