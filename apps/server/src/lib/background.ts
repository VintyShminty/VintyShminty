import { waitUntil } from "@vercel/functions";

const pending = new Set<Promise<unknown>>();

/**
 * Runs work that finishes after the response has gone. On Vercel `waitUntil` keeps the function alive until it is done
 * (see docs/knowledge/gotchas.md). The promise is also remembered so a test can wait for it with `settleBackground`.
 * The work must catch its own errors, a rejected promise here is swallowed.
 */
export function runInBackground(work: Promise<unknown>): void {
  const tracked = work.catch(() => undefined);
  pending.add(tracked);
  void tracked.finally(() => pending.delete(tracked));
  waitUntil(tracked);
}

/** Tests only: resolves when all background work started so far (and anything it started) is done. */
export async function settleBackground(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending]);
}
