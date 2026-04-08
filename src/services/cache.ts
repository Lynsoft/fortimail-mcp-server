/**
 * Dual-backend cache layer — in-memory (default) or Redis.
 *
 * The cache is keyed by a string and stores JSON-serialisable values.
 * Each entry has an independent TTL (seconds).
 */

import type { Redis } from "ioredis";

// ─── Cache interface ─────────────────────────────────────────────────────────

export interface CacheBackend {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  flush(): Promise<void>;
}

// ─── In-memory implementation ────────────────────────────────────────────────

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCache implements CacheBackend {
  private store = new Map<string, MemoryEntry>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

// ─── Redis implementation ────────────────────────────────────────────────────

export class RedisCache implements CacheBackend {
  private prefix: string;
  private client: Redis;

  constructor(client: Redis, prefix = "fml:") {
    this.client = client;
    this.prefix = prefix;
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(this.k(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(this.k(key), JSON.stringify(value), "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.k(key));
  }

  async flush(): Promise<void> {
    // Only flush keys with our prefix
    let cursor = "0";
    do {
      const [next, keys] = await this.client.scan(
        cursor,
        "MATCH",
        `${this.prefix}*`,
        "COUNT",
        100,
      );
      cursor = next;
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== "0");
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

let _cache: CacheBackend | undefined;

export function getCache(): CacheBackend {
  if (_cache) return _cache;
  _cache = new MemoryCache();
  return _cache;
}

export function setCache(backend: CacheBackend): void {
  _cache = backend;
}
