"use client";

import { favouriteResultSchema } from "@vinty/shared";
import { Bookmark } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * The bookmark with the number of people who saved the item (D-032), on the item page. Logged out it opens the login prompt. Logged in it calls
 * PUT/DELETE /v1/listings/:id/favourite, changes at once and goes back if the server says no.
 */
export function FavouriteButton({
  listingId,
  initial,
  count,
}: {
  listingId: string;
  initial: boolean;
  count: number;
}) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const [favourited, setFavourited] = useState(initial);
  const [total, setTotal] = useState(count);

  const onClick = () => {
    if (!viewer) {
      ask();
      return;
    }
    const next = !favourited;
    setFavourited(next);
    setTotal((n) => Math.max(0, n + (next ? 1 : -1)));
    clientApi(`/v1/listings/${listingId}/favourite`, {
      method: next ? "PUT" : "DELETE",
      schema: favouriteResultSchema,
    })
      .then((result) => setTotal(result.favouriteCount))
      .catch(() => {
        setFavourited(!next);
        setTotal((n) => Math.max(0, n + (next ? -1 : 1)));
      });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={favourited}
      aria-label={`${favourited ? t("item.removeFavourite") : t("item.addFavourite")}, ${total}`}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-xs rounded-full border px-md text-pill hover:bg-pressed",
        favourited ? "border-error bg-error-tint text-error" : "border-text-4 text-text-1",
      )}
    >
      <Bookmark
        size={18}
        aria-hidden
        className={favourited ? "text-error" : "text-text-1"}
        fill={favourited ? "currentColor" : "none"}
      />
      <span aria-live="polite">{total}</span>
    </button>
  );
}
