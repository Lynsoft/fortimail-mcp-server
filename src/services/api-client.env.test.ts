import { describe, it, expect, vi, beforeEach } from "vitest";

describe("getClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("throws when engine env vars are missing", async () => {
    const { getClient } = await import("./api-client.js");
    expect(() => getClient()).toThrow(/FORTIMAIL_ENGINE_URL/);
  });

  it("returns EngineClient when URL and API key are set", async () => {
    vi.stubEnv("FORTIMAIL_ENGINE_URL", "https://engine.example.com/v1");
    vi.stubEnv("FORTIMAIL_ENGINE_API_KEY", "fme_test_key");
    vi.stubEnv("FORTIMAIL_VERIFY_CERT", "false");
    const { getClient, EngineClient } = await import("./api-client.js");
    const c = getClient();
    expect(c).toBeInstanceOf(EngineClient);
    expect(c.baseUrl).toBe("https://engine.example.com/v1");
  });
});
