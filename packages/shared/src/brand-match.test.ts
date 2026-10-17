import { describe, expect, it } from "vitest";
import { hebrewSkeleton, latinSkeletons, soundsAlike } from "./brand-match.js";

describe("brand sound skeletons", () => {
  it("gives Michael Kors the same skeleton in both alphabets", () => {
    expect(hebrewSkeleton("מייקל קורס")).toBe("mklkrs");
    expect(latinSkeletons("MICHAEL KORS")).toContain("mklkrs");
  });

  it.each([
    ["זארה", "Zara"],
    ["נייקי", "Nike"],
    ["אדידס", "Adidas"],
    ["ליוויס", "Levi's"],
    ["דיזל", "Diesel"],
    ["מייקל קורס", "michael kors"],
    ["קלווין קליין", "Calvin Klein"],
  ])("%s sounds like %s", (hebrew, latin) => {
    expect(soundsAlike(hebrew, latin)).toBe(true);
  });

  it("does not match unrelated brands or very short skeletons", () => {
    expect(soundsAlike("נייקי", "Adidas")).toBe(false);
    expect(soundsAlike("לי", "Lee")).toBe(false);
  });
});
