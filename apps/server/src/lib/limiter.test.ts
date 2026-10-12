import { describe, expect, it } from "vitest";
import { WindowLimiter } from "./limiter.js";

describe("WindowLimiter", () => {
  it("allows the limit, refuses the next one, and forgives after the window", () => {
    let now = 0;
    const limiter = new WindowLimiter(2, 1000, () => now);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(false);
    expect(limiter.retryAfterSeconds("a")).toBe(1);
    expect(limiter.take("b")).toBe(true);
    now = 1001;
    expect(limiter.take("a")).toBe(true);
  });
});
