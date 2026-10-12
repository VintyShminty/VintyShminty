import type { LucideIcon, LucideProps } from "lucide-react-native";
import { cssInterop } from "nativewind";
import * as React from "react";
import { TextStyleContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type IconProps = LucideProps & {
  as: LucideIcon;
};

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />;
}

cssInterop(IconImpl, {
  className: {
    target: "style",
    nativeStyleToProp: { height: "size", width: "size" },
  },
});

/**
 * Lucide icon with className support. Takes the text colour of its surroundings, never emoji.
 * Sizes: 13, 16, 20 (default), 24. Stroke 1.75 (docs/components.md).
 */
function Icon({ as: IconComponent, className, size = 20, strokeWidth = 1.75, ...props }: IconProps) {
  const ctx = React.useContext(TextStyleContext);
  return (
    <IconImpl
      as={IconComponent}
      className={cn("text-foreground", ctx.className, className)}
      size={size}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

export { Icon };
