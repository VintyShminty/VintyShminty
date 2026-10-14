import { Award, BadgeCheck, Leaf, type LucideIcon, Sparkles, Zap } from "lucide-react";

// Lucide icon for each badge icon name in the database. Unknown names fall back to a medal (same as the app).
const BADGE_ICONS: Record<string, LucideIcon> = {
  upload: Sparkles,
  sparkles: Sparkles,
  award: Award,
  zap: Zap,
  "badge-check": BadgeCheck,
  leaf: Leaf,
};

/** A seller badge as a stamp (D-019, row 13): an outline in the accent colour with an icon and the name. */
export function SellerStamp({ icon, label }: { icon: string; label: string }) {
  const Icon = BADGE_ICONS[icon] ?? Award;
  return (
    <span className="inline-flex h-8 items-center gap-xs rounded-full border border-primary bg-background px-[12px] text-pill font-semibold text-primary">
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
}
