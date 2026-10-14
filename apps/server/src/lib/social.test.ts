import { exportPKCS8, generateKeyPair } from "jose";
import { describe, expect, it, vi } from "vitest";
import { appleOptions, createAppleSecret, normalizeApplePem } from "./social.js";

const base = {
  APPLE_APP_BUNDLE_IDENTIFIER: "com.example.app",
  APPLE_CLIENT_ID: "com.example.app.web",
  APPLE_CLIENT_SECRET: undefined,
  APPLE_TEAM_ID: "TEAM123456",
  APPLE_KEY_ID: "KEY1234567",
};

async function realPem() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  return exportPKCS8(privateKey);
}

describe("normalizeApplePem", () => {
  it("reads the key however it was pasted", async () => {
    const pem = await realPem();
    const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
    const pastes = [
      pem,
      pem.replace(/\n/g, "\\n"),
      pem.replace(/\n/g, " "),
      `"${pem}"`,
      body,
      `  ${pem}\n\n`,
    ];
    for (const paste of pastes) {
      await expect(
        createAppleSecret({ clientId: "c", teamId: "t", keyId: "k", privateKey: paste }),
      ).resolves.toMatch(/^ey/);
    }
    expect(normalizeApplePem(body)).toBe(normalizeApplePem(pem));
  });
});

describe("appleOptions", () => {
  it("keeps the server running with an unreadable key, the phone's Apple sign in keeps working", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const options = await appleOptions({ ...base, APPLE_PRIVATE_KEY: "not a key" });
    expect(options.clientSecret).toBe("");
    expect(options.audience).toContain("com.example.app");
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0]?.[0])).not.toContain("not a key");
    log.mockRestore();
  });

  it("makes the secret from a good key", async () => {
    const options = await appleOptions({ ...base, APPLE_PRIVATE_KEY: await realPem() });
    expect(options.clientSecret).toMatch(/^ey/);
  });
});
