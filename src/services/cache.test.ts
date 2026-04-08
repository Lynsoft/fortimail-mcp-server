import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCache } from "./cache.js";

describe("MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  it("returns undefined for missing key", async () => {
    expect(await cache.get("nope")).toBeUndefined();
  });

  it("round-trips a value before TTL expiry", async () => {
    await cache.set("k", { a: 1 }, 60);
    expect(await cache.get<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("deletes a single key", async () => {
    await cache.set("a", 1, 60);
    await cache.del("a");
    expect(await cache.get("a")).toBeUndefined();
  });

  it("flush clears all keys", async () => {
    await cache.set("x", 1, 60);
    await cache.set("y", 2, 60);
    await cache.flush();
    expect(await cache.get("x")).toBeUndefined();
    expect(await cache.get("y")).toBeUndefined();
  });
});
