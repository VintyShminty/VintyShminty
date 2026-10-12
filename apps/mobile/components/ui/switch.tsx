import * as SwitchPrimitives from "@rn-primitives/switch";
import { cn } from "@/lib/utils";

// Track is the pressed surface when off and espresso when on. The thumb is placed with
// justify-start / justify-end, not a translate, so it flips correctly in right-to-left layouts.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        "h-7 w-12 shrink-0 flex-row items-center rounded-full px-0.5",
        props.checked ? "justify-end bg-primary" : "justify-start bg-pressed",
        props.disabled && "opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb className="size-6 rounded-full bg-background" />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
