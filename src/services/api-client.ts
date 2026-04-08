/**
 * FortiMail Engine HTTP client (Bearer API key only — no direct appliance access).
 *
 * OpenAPI: `openapi/openapi.json` (generated types in `src/generated/engine-schema.ts`).
 */

import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import https from "node:https";
import {
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
} from "../constants.js";
import { getCache, type CacheBackend } from "./cache.js";

// ─── Config ─────────────────────────────────────────────────────────────────

export interface EngineClientConfig {
  /** Base URL including `/v1`, e.g. `https://engine.example.com/v1` */
  baseUrl: string;
  /** Engine API key (`fme_...`). */
  apiKey: string;
  /** Reject invalid TLS (default true). */
  verifyCert?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransient(err: AxiosError): boolean {
  if (!err.response) return true;
  const s = err.response.status;
  return s === 429 || s === 502 || s === 503 || s === 504;
}

export function normalizeEngineBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class EngineClient {
  private ax: AxiosInstance;
  readonly baseUrl: string;
  private readonly verifyCert: boolean;
  private cache: CacheBackend;

  constructor(cfg: EngineClientConfig) {
    this.baseUrl = normalizeEngineBaseUrl(cfg.baseUrl);
    this.verifyCert = cfg.verifyCert ?? true;
    this.cache = getCache();

    this.ax = axios.create({
      baseURL: this.baseUrl,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: this.verifyCert,
      }),
    });
  }

  /** GET /health — no Bearer (OpenAPI: security []). */
  async getLiveness(): Promise<unknown> {
    const ax = axios.create({
      baseURL: this.baseUrl,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Accept: "application/json" },
      httpsAgent: new https.Agent({
        rejectUnauthorized: this.verifyCert,
      }),
    });
    const res = await ax.get("/health");
    return res.data;
  }

  /** GET /health/detailed — requires Bearer. */
  async getReadiness(): Promise<unknown> {
    const res = await this.ax.get("/health/detailed");
    return res.data;
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    data?: unknown,
    params?: Record<string, unknown>,
    cacheTtl?: number,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const cacheKey =
      method === "GET" && cacheTtl
        ? `req:${path}:${JSON.stringify(params ?? {})}`
        : undefined;

    if (cacheKey) {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached !== undefined) return cached;
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const cfg: AxiosRequestConfig = {
          method,
          url: path,
          data,
          params,
          headers: extraHeaders,
        };
        const res: AxiosResponse<T> = await this.ax.request(cfg);

        if (cacheKey && cacheTtl) {
          await this.cache.set(cacheKey, res.data, cacheTtl);
        }

        return res.data;
      } catch (err) {
        lastError = err;
        if (err instanceof AxiosError && isTransient(err) && attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        break;
      }
    }
    throw lastError;
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    cacheTtl?: number,
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, params, cacheTtl);
  }

  async post<T = unknown>(path: string, data?: unknown): Promise<T> {
    return this.request<T>("POST", path, data);
  }

  async put<T = unknown>(path: string, data?: unknown): Promise<T> {
    return this.request<T>("PUT", path, data);
  }

  async delete<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    data?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("DELETE", path, data, params, undefined, extraHeaders);
  }

  /**
   * POST returning raw bytes (e.g. log/report download). Not cached.
   */
  async postBuffer(path: string, data?: unknown): Promise<Buffer> {
    const res = await this.ax.post<ArrayBuffer>(path, data, {
      responseType: "arraybuffer",
    });
    return Buffer.from(res.data);
  }

  async flushCache(): Promise<void> {
    await this.cache.flush();
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _client: EngineClient | undefined;

export function getClient(): EngineClient {
  if (!_client) {
    const baseUrl = process.env.FORTIMAIL_ENGINE_URL;
    const apiKey = process.env.FORTIMAIL_ENGINE_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error(
        "FORTIMAIL_ENGINE_URL and FORTIMAIL_ENGINE_API_KEY are required. " +
          "This MCP connects only to the FortiMail Engine API (scoped Bearer token), not the appliance.",
      );
    }
    _client = new EngineClient({
      baseUrl,
      apiKey,
      verifyCert: process.env.FORTIMAIL_VERIFY_CERT !== "false",
    });
  }
  return _client;
}

// ─── Error formatter ─────────────────────────────────────────────────────────

export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const s = error.response.status;
      const body =
        typeof error.response.data === "string"
          ? error.response.data
          : JSON.stringify(error.response.data);
      switch (s) {
        case 401:
          return (
            "Error: Authentication failed. Check FORTIMAIL_ENGINE_API_KEY (Bearer) and required scopes " +
            "(e.g. fortimail:read / fortimail:write)."
          );
        case 403:
          return "Error: Permission denied. The API key lacks the required scope for this operation.";
        case 404:
          return "Error: Resource not found. Verify keys, domain names, or paths.";
        case 429:
          return "Error: Rate limit exceeded. Wait a moment and retry.";
        default:
          return `Error: FortiMail Engine returned HTTP ${s} — ${body}`;
      }
    }
    if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. The FortiMail Engine may be unreachable.";
    }
    if (error.code === "ECONNREFUSED") {
      return "Error: Connection refused. Verify FORTIMAIL_ENGINE_URL and TLS/port.";
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
