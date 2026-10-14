import type { QueryClient } from "@tanstack/react-query";
import {
  type Persister,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/react-query-persist-client";
import { PERSIST_MAX_AGE, persistBuster, shouldPersistQuery } from "./query-persist";

/**
 * Brings the saved feed back and keeps saving, for one known person. Never call it while signed out.
 * The saved copy carries the person's id in its buster, so a copy that belongs to someone else is dropped
 * instead of shown. `restored` resolves when the saved copy is in memory (or there was none), `stop` ends the saving.
 */
export function startPersistence(opts: {
  queryClient: QueryClient;
  persister: Persister;
  appVersion: string;
  userId: string;
}): { restored: Promise<void>; stop: () => void } {
  const options = {
    queryClient: opts.queryClient,
    persister: opts.persister,
    maxAge: PERSIST_MAX_AGE,
    buster: persistBuster(opts.appVersion, opts.userId),
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
  let stopped = false;
  let unsubscribe: (() => void) | undefined;
  // Saving starts only after the restore, so an empty memory never overwrites the saved copy.
  const restored = persistQueryClientRestore(options)
    .catch(() => {})
    .then(() => {
      if (!stopped) unsubscribe = persistQueryClientSubscribe(options);
    });
  return {
    restored,
    stop: () => {
      stopped = true;
      unsubscribe?.();
    },
  };
}
