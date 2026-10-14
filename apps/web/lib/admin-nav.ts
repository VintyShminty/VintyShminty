import {
  BarChart3,
  LayoutDashboard,
  type LucideIcon,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

/**
 * The pages of the back office, in the order of the sidebar. To add a page: add a
 * row here, the wording under `admin.nav.<key>` in both languages, and the page under app/[lang]/admin/<path>.
 * `path` is empty for the dashboard.
 */
export const ADMIN_NAV: { key: string; path: string; icon: LucideIcon }[] = [
  { key: "dashboard", path: "", icon: LayoutDashboard },
  { key: "review", path: "/review", icon: ShieldAlert },
  { key: "users", path: "/users", icon: Users },
  { key: "analytics", path: "/analytics", icon: BarChart3 },
  { key: "expenses", path: "/expenses", icon: ReceiptText },
  { key: "security", path: "/security", icon: ShieldCheck },
  { key: "upload", path: "/upload", icon: Upload },
];
