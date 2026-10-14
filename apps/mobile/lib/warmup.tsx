import type { InfiniteData } from "@tanstack/react-query";
import type { HomeFeedPage } from "@vinty/shared";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { feedQuery } from "@/lib/discovery-queries";
import { personalisationSizesQuery } from "@/lib/item-queries";
import { startPersistence } from "@/lib/persist-session";
import { meQuery, referenceQuery } from "@/lib/queries";
import { queryClient, queryPersister, wipeLocalData } from "@/lib/query-client";

/** How many cover photos are downloaded ahead of time, the ones in the first screen of the feed. */
const PREFETCH_PHOTOS = 8;

/**
 * Starts the Home requests as soon as the app is up, instead of waiting for Home to open, then downloads the
 * first cover photos. Home asks for the same things, so it just picks up the answers. It renders nothing.
 */
export function Warmup() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  // Safety net: if the person changes or the session ends without our own sign out button (for example the
  // server closed it), the old person's feed must not stay on the phone for the next one.
  const lastUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastUser.current && lastUser.current !== userId) void wipeLocalData();
    lastUser.current = userId;
  }, [userId]);

  // Once the person is known: bring their saved feed back, then ask the server for fresh data.
  // Signed out phones restore and save nothing.
  useEffect(() => {
    if (!userId) {
      void queryClient.prefetchQuery(referenceQuery());
      void warmFeed();
      return;
    }
    const saving = startPersistence({
      queryClient,
      persister: queryPersister,
      appVersion: Constants.expoConfig?.version ?? "1.0",
      userId,
    });
    void saving.restored.then(() => {
      void queryClient.prefetchQuery(referenceQuery());
      void queryClient.prefetchQuery(meQuery());
      void queryClient.prefetchQuery(personalisationSizesQuery());
      void warmFeed();
    });
    return saving.stop;
  }, [userId]);

  return null;
}

async function warmFeed() {
  const feed = feedQuery({ mood: "for_you" });
  await queryClient.prefetchInfiniteQuery(feed);
  const pages = queryClient.getQueryData<InfiniteData<HomeFeedPage>>(feed.queryKey)?.pages;
  const urls = (pages?.[0]?.items ?? [])
    .map((card) => card.cover?.url)
    .filter((url): url is string => Boolean(url))
    .slice(0, PREFETCH_PHOTOS);
  if (urls.length > 0) void Image.prefetch(urls);
}
