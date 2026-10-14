import { Bookmark, CircleHelp, Heart, type LucideIcon, Package, Settings, User, Wallet } from "lucide-react";

/** The pages behind the avatar menu and the phone drawer, in order. `key` is the wording under `web.auth.menu`. */
export const ACCOUNT_LINKS: { key: string; path: string; icon: LucideIcon }[] = [
  { key: "profile", path: "/profile", icon: User },
  { key: "orders", path: "/orders", icon: Package },
  { key: "balance", path: "/balance", icon: Wallet },
  { key: "favourites", path: "/favourites", icon: Heart },
  { key: "savedSearches", path: "/saved-searches", icon: Bookmark },
  { key: "settings", path: "/settings", icon: Settings },
  { key: "help", path: "/help", icon: CircleHelp },
];
