import { isServer, keepPreviousData, QueryClient } from "@tanstack/react-query";

// Design rule (same as the app): never blank a screen while reloading. Cached data shows at once, a refetch runs in
// the background, and when a query key changes the previous result stays until the new one arrives.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** One client per visitor in the browser, a fresh one for each request on the server. */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
