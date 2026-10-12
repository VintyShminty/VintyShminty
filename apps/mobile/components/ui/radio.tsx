import { View } from "react-native";
import { cn } from "@/lib/utils";

/** Round dot for picking exactly one option (docs/components.md, Radio). The row around it is the touch target. */
function Radio({
  checked,
  disabled,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px]",
        checked ? "border-primary" : "border-text-4",
        disabled && "opacity-40",
        className,
      )}
    >
      {checked ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
    </View>
  );
}

export { Radio };
