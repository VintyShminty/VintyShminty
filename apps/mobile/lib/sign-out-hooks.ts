// Things to do while the person is still signed in, just before sign out goes to the server
// (forget this phone for push, close the live connection). Kept free of imports so any file can use it.

const hooks = new Set<() => Promise<void> | void>();

/** Registers a task to run before sign out. Returns a function that removes it. */
export function beforeSignOut(task: () => Promise<void> | void): () => void {
  hooks.add(task);
  return () => {
    hooks.delete(task);
  };
}

/** Runs every task, never fails and never waits more than 3 seconds, so signing out always works. */
export async function runBeforeSignOut(): Promise<void> {
  const all = Promise.allSettled([...hooks].map((task) => Promise.resolve().then(task)));
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, 3000))]);
}
