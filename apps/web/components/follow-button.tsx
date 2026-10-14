"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Follow / Following on a seller page. Logged out it opens the login prompt. Logged in it calls PUT/DELETE
 * /v1/users/:id/follow, flips at once, goes back if the server says no, and refreshes the page numbers after.
 */
export function FollowButton({ userId, name, initial }: { userId: string; name: string; initial: boolean }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  const onClick = () => {
    if (!viewer) {
      ask();
      return;
    }
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    clientApi(`/v1/users/${userId}/follow`, { method: next ? "PUT" : "DELETE" })
      .then(() => router.refresh())
      .catch(() => setFollowing(!next))
      .finally(() => setBusy(false));
  };

  const Icon = following ? UserCheck : UserPlus;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={following}
      aria-label={following ? t("web.seller.unfollowLabel", { name }) : t("web.seller.followLabel", { name })}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-xs rounded-control px-lg text-body-sm font-semibold",
        following
          ? "border border-primary text-primary hover:bg-accent-tint"
          : "bg-primary text-on-accent hover:opacity-90",
      )}
    >
      <Icon size={18} aria-hidden />
      {following ? t("web.seller.following") : t("web.seller.follow")}
    </button>
  );
}
