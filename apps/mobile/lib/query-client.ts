import { keepPreviousData, QueryClient } from "@tanstack/react-query";

// Design rule: never blank a screen while reloading (stale-while-revalidate).
// Cached data shows instantly, a refetch runs in the background, and when a query key changes
// the previous result stays on screen until the new one arrives (placeholderData).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
