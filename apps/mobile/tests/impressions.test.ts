import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMPRESSION_MS, ImpressionTracker, type Seen } from "../lib/impressions";

describe("ImpressionTracker", () => {
  let seen: Seen[];
  let tracker: ImpressionTracker;
  beforeEach(() => {
    vi.useFakeTimers();
    seen = [];
    tracker = new ImpressionTracker((s) => seen.push(s));
    tracker.setFeed("feed-1");
  });
  afterEach(() => {
    tracker.dispose();
    vi.useRealTimers();
  });

  it("counts a card after one full second", () => {
    tracker.setVisible([{ listingId: "a", position: 4 }]);
    vi.advanceTimersByTime(IMPRESSION_MS - 1);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([{ listingId: "a", position: 4, feedId: "feed-1" }]);
  });

  it("does not count a card that scrolled away early", () => {
    tracker.setVisible([{ listingId: "a", position: 0 }]);
    vi.advanceTimersByTime(600);
    tracker.setVisible([]);
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual([]);
  });

  it("counts a card once per list, even if it comes back", () => {
    tracker.setVisible([{ listingId: "a", position: 0 }]);
    vi.advanceTimersByTime(1000);
    tracker.setVisible([]);
    tracker.setVisible([{ listingId: "a", position: 0 }]);
    vi.advanceTimersByTime(2000);
    expect(seen).toHaveLength(1);
  });

  it("counts the card again in a new list", () => {
    tracker.setVisible([{ listingId: "a", position: 0 }]);
    vi.advanceTimersByTime(1000);
    tracker.setFeed("feed-2");
    vi.advanceTimersByTime(1000);
    expect(seen.map((s) => s.feedId)).toEqual(["feed-1", "feed-2"]);
  });

  it("stops the clock while paused and starts it again on resume", () => {
    tracker.setVisible([{ listingId: "a", position: 0 }]);
    vi.advanceTimersByTime(700);
    tracker.pause();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
    tracker.resume();
    vi.advanceTimersByTime(999);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toHaveLength(1);
  });

  it("counts two cards on screen at once", () => {
    tracker.setVisible([
      { listingId: "a", position: 0 },
      { listingId: "b", position: 1 },
    ]);
    vi.advanceTimersByTime(1000);
    expect(seen.map((s) => s.listingId)).toEqual(["a", "b"]);
  });
});
