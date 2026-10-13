// "Card seen" logic: a card counts when it has been at least half visible for a full second, once per feed list.
// Kept free of React Native imports so it can be tested on its own. The hook that feeds it is `use-impressions.ts`.

export const IMPRESSION_MS = 1000;

export type Seen = { listingId: string; position: number; feedId: string | null };

type Timers = {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

class ImpressionTracker {
  private visible = new Map<string, number>();
  private pending = new Map<string, unknown>();
  private seen = new Set<string>();
  private feedId: string | null = null;
  private paused = false;

  constructor(
    private readonly onSeen: (seen: Seen) => void,
    private readonly timers: Timers = realTimers,
  ) {}

  /** A new list (pull to refresh, other mood) starts again: every card can count once more. */
  setFeed(feedId: string | null): void {
    if (feedId === this.feedId) return;
    this.feedId = feedId;
    this.seen.clear();
    this.cancelAll();
    if (!this.paused) for (const id of this.visible.keys()) this.start(id);
  }

  /** The cards now half visible, with their index in the list. Cards that left before 1 second do not count. */
  setVisible(cards: { listingId: string; position: number }[]): void {
    const next = new Map(cards.map((c) => [c.listingId, c.position]));
    for (const id of this.pending.keys()) {
      if (!next.has(id)) this.cancel(id);
    }
    this.visible = next;
    if (this.paused) return;
    for (const id of next.keys()) {
      if (!this.pending.has(id)) this.start(id);
    }
  }

  /** Off screen (another tab, a pushed page): the clock stops and starts again from zero on resume. */
  pause(): void {
    this.paused = true;
    this.cancelAll();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const id of this.visible.keys()) this.start(id);
  }

  dispose(): void {
    this.cancelAll();
    this.visible.clear();
  }

  private start(id: string): void {
    if (this.seen.has(id) || this.pending.has(id)) return;
    this.pending.set(
      id,
      this.timers.set(() => {
        this.pending.delete(id);
        if (this.seen.has(id)) return;
        this.seen.add(id);
        this.onSeen({ listingId: id, position: this.visible.get(id) ?? 0, feedId: this.feedId });
      }, IMPRESSION_MS),
    );
  }

  private cancel(id: string): void {
    const handle = this.pending.get(id);
    if (handle !== undefined) this.timers.clear(handle);
    this.pending.delete(id);
  }

  private cancelAll(): void {
    for (const id of [...this.pending.keys()]) this.cancel(id);
  }
}

export { ImpressionTracker };
