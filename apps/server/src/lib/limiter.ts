/**
 * Counts events per key inside a sliding window, kept in memory.
 * Used for "5 reset codes per hour per email". One server process only, which is right for now.
 */
export class WindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records an event. Returns false (and records nothing) when the key is over its limit. */
  take(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Records `count` events at once, or none when they would not all fit. */
  takeMany(key: string, count: number): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length + count > this.max) {
      this.hits.set(key, recent);
      return false;
    }
    for (let i = 0; i < count; i++) recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Seconds until the key may try again. */
  retryAfterSeconds(key: string): number {
    const first = (this.hits.get(key) ?? [])[0];
    return first === undefined ? 0 : Math.max(1, Math.ceil((first + this.windowMs - this.now()) / 1000));
  }
}
