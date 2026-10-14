import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { keepPreviousData, QueryClient } from "@tanstack/react-query";
import { PERSIST_KEY } from "@/lib/query-persist";

// Design rule: never blank a screen while reloading (stale-while-revalidate).
// Cached data shows instantly, a refetch runs in the background, and when a query key changes
// the previous result stays on screen until the new one arrives (placeholderData).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Must be at least the saved copy's max age, or restored data would be dropped from memory too early.
      gcTime: 7 * 24 * 60 * 60 * 1000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Writes the Home feed and reference data to the phone (see query-persist.ts for what is kept). */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 2000,
});

/**
 * Sign out and account deletion: forgets everything in memory and deletes the saved copy on the phone,
 * so the next person never sees the last feed.
 */
export async function wipeLocalData(): Promise<void> {
  queryClient.clear();
  try {
    await queryPersister.removeClient();
  } catch (err) {
    if (__DEV__) console.warn("Could not delete the saved feed:", err);
  }
}
