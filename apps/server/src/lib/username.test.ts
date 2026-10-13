import { USERNAME_MAX, USERNAME_MIN, usernameSchema } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { generateUsername, usernameBase } from "./username.js";

const free = async () => false;

describe("usernameBase", () => {
  it("lowercases and keeps letters, numbers, dots and underscores", () => {
    expect(usernameBase("Tamar.Avraham@example.com")).toBe("tamar.avraham");
    expect(usernameBase("a-b+c_d@example.com")).toBe("abc_d");
  });
  it("uses the part before the last @ and drops other characters", () => {
    expect(usernameBase('"odd name"@example.com')).toBe("oddname");
    expect(usernameBase("אבגabc@example.com")).toBe("abc");
  });
  it("trims dots and underscores at both ends", () => {
    expect(usernameBase("._.noa.levi._@example.com")).toBe("noa.levi");
  });
  it("cuts to the maximum length", () => {
    expect(usernameBase(`${"a".repeat(40)}@example.com`)).toHaveLength(USERNAME_MAX);
  });
  it("can come back empty", () => {
    expect(usernameBase("...@example.com")).toBe("");
  });
});

describe("generateUsername", () => {
  it("uses the email start as is when it is free", async () => {
    expect(await generateUsername("Oliver.Smith@example.com", free)).toBe("oliver.smith");
  });

  it("adds digits when taken, and the result is valid", async () => {
    const taken = new Set(["oliver.smith"]);
    const name = await generateUsername("oliver.smith@example.com", async (c) => taken.has(c));
    expect(name).toMatch(/^oliver\.smith\d{2}$/);
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it("cuts a long start to leave room for the digits", async () => {
    const taken = new Set(["a".repeat(USERNAME_MAX)]);
    const name = await generateUsername(`${"a".repeat(30)}@example.com`, async (c) => taken.has(c));
    expect(name.length).toBeLessThanOrEqual(USERNAME_MAX);
    expect(name).toMatch(/^a+\d{2}$/);
  });

  it("does not leave a dot or underscore right before the digits", async () => {
    const email = `${"a".repeat(21)}._bbbb@example.com`;
    const taken = new Set([usernameBase(email)]);
    const name = await generateUsername(email, async (c) => taken.has(c));
    expect(name).not.toMatch(/[._]\d+$/);
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it("pads a start that is too short", async () => {
    const name = await generateUsername("al@example.com", free);
    expect(name.startsWith("al")).toBe(true);
    expect(name.length).toBeGreaterThanOrEqual(USERNAME_MIN);
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it("falls back to user plus digits when nothing is left", async () => {
    const name = await generateUsername("...@example.com", free);
    expect(name).toMatch(/^user\d*$/);
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it("keeps trying with more digits when everything short is taken", async () => {
    const name = await generateUsername("sam@example.com", async (c) => c.length < 8);
    expect(name.length).toBeGreaterThanOrEqual(8);
  });

  it("gives up with an error when nothing is ever free", async () => {
    await expect(generateUsername("sam@example.com", async () => true)).rejects.toThrow();
  });
});
