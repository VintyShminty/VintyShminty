import { describe, expect, it } from "vitest";
import { persistBuster, shouldPersistQuery } from "../lib/query-persist";

const q = (queryKey: unknown[], status = "success") => ({ queryKey, state: { status } }) as never;

describe("what is saved on the phone", () => {
  it("saves the plain For you feed and the reference data", () => {
    expect(shouldPersistQuery(q(["feed", null, false, null]))).toBe(true);
    expect(shouldPersistQuery(q(["feed", null, false, "for_you"]))).toBe(true);
    expect(shouldPersistQuery(q(["feed", null, false, "for_you", null]))).toBe(true);
    expect(shouldPersistQuery(q(["reference"]))).toBe(true);
    expect(shouldPersistQuery(q(["feed", null, false, null, null, null, null]))).toBe(true);
  });

  it("saves nothing else", () => {
    expect(shouldPersistQuery(q(["feed", null, false, "near_you"]))).toBe(false);
    expect(shouldPersistQuery(q(["feed", "cat-1", false, null]))).toBe(false);
    expect(shouldPersistQuery(q(["feed", null, true, null]))).toBe(false);
    expect(shouldPersistQuery(q(["feed", null, false, null, "women"]))).toBe(false);
    expect(shouldPersistQuery(q(["feed", null, false, "for_you", "men"]))).toBe(false);
    expect(shouldPersistQuery(q(["feed", null, false, null, null, 5000, null]))).toBe(false);
    expect(shouldPersistQuery(q(["feed", null, false, null, null, null, 10000]))).toBe(false);
    expect(shouldPersistQuery(q(["feed", null, false, "for_you", null, 5000, 10000]))).toBe(false);
    for (const key of ["me", "settings", "threads", "orders", "feed-hidden", "personalisation-sizes"])
      expect(shouldPersistQuery(q([key]))).toBe(false);
  });

  it("does not save a query that failed or is still loading", () => {
    expect(shouldPersistQuery(q(["reference"], "error"))).toBe(false);
    expect(shouldPersistQuery(q(["reference"], "pending"))).toBe(false);
  });

  it("gives each person and each app version their own copy", () => {
    expect(persistBuster("1.0.0", "a")).not.toBe(persistBuster("1.0.0", "b"));
    expect(persistBuster("1.0.0", "a")).not.toBe(persistBuster("1.0.1", "a"));
    expect(persistBuster("1.0.0", undefined)).not.toBe(persistBuster("1.0.0", "a"));
  });
});
