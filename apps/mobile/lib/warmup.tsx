import { type InfiniteData, useIsRestoring } from "@tanstack/react-query";
import type { HomeFeedPage } from "@vinty/shared";
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { feedQuery } from "@/lib/discovery-queries";
import { personalisationSizesQuery } from "@/lib/item-queries";
import { meQuery, referenceQuery } from "@/lib/queries";
import { queryClient, wipeLocalData } from "@/lib/query-client";

/** How many cover photos are downloaded ahead of time, the ones in the first screen of the feed. */
const PREFETCH_PHOTOS = 8;

/**
 * Starts the Home requests as soon as the app is up, instead of waiting for Home to open, then downloads the
 * first cover photos. Home asks for the same things, so it just picks up the answers. It renders nothing.
 */
export function Warmup({ signedIn }: { signedIn: boolean }) {
  const restoring = useIsRestoring();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  // Safety net: if the person changes or the session ends without our own sign out button (for example the
  // server closed it), the old person's feed must not stay on the phone for the next one.
  const lastUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastUser.current && lastUser.current !== userId) void wipeLocalData();
    lastUser.current = userId;
  }, [userId]);

  useEffect(() => {
    if (restoring) return;
    const feed = feedQuery({ mood: "for_you" });
    void queryClient.prefetchQuery(referenceQuery());
    if (signedIn) {
      void queryClient.prefetchQuery(meQuery());
      void queryClient.prefetchQuery(personalisationSizesQuery());
    }
    void queryClient.prefetchInfiniteQuery(feed).then(() => {
      const pages = queryClient.getQueryData<InfiniteData<HomeFeedPage>>(feed.queryKey)?.pages;
      const urls = (pages?.[0]?.items ?? [])
        .map((card) => card.cover?.url)
        .filter((url): url is string => Boolean(url))
        .slice(0, PREFETCH_PHOTOS);
      if (urls.length > 0) void Image.prefetch(urls);
    });
  }, [restoring, signedIn]);

  return null;
}
