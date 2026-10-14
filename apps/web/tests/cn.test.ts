import { describe, expect, it } from "vitest";
import { cn } from "../lib/utils";

describe("cn", () => {
  it("keeps our text sizes next to our text colours", () => {
    expect(cn("text-card-meta", "text-text-3")).toBe("text-card-meta text-text-3");
    expect(cn("text-body", "text-body-sm")).toBe("text-body-sm");
    expect(cn("rounded-control", "rounded-full")).toBe("rounded-full");
  });
});
