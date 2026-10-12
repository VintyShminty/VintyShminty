import { Check } from "lucide-react-native";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Square tick box for yes or no and for picking several options (docs/components.md, Checkbox). */
function Checkbox({
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
        "h-[22px] w-[22px] items-center justify-center rounded-[6px] border-[1.5px]",
        checked ? "border-primary bg-primary" : "border-text-4 bg-background",
        disabled && "opacity-40",
        className,
      )}
    >
      {checked ? <Icon as={Check} size={16} strokeWidth={2.5} className="text-primary-foreground" /> : null}
    </View>
  );
}

export { Checkbox };
