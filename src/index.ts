#!/usr/bin/env node
/**
 * FortiMail MCP Server — thin client for the FortiMail Engine API (OpenAPI `/v1`).
 *
 * Uses Bearer API keys only (no direct FortiMail appliance admin login).
 * Caching, HTTP transport, and MCP HTTP auth behave as before.
 */

import "./load-env.js";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { z } from "zod";

/**
 * Smithery session configuration schema.
 * Exported so `smithery` CLI can extract it automatically.
 */
export const configSchema = z.object({
  /** Same value as host `MCP_HTTP_BEARER_TOKEN` (Smithery UI field name). */
  mcp_bearer_token: z
    .string()
    .optional()
    .describe("Bearer token for authenticating to the FortiMail MCP server"),
  verifyCert: z
    .boolean()
    .optional()
    .default(true)
    .describe("Verify FortiMail Engine TLS certificate (disable for self-signed)"),
  cacheBackend: z
    .enum(["memory", "redis"])
    .optional()
    .default("memory")
    .describe("MCP response cache backend"),
});

import { setCache, MemoryCache, RedisCache } from "./services/cache.js";
import {
  isMcpHttpAuthorized,
  mcpAuthDebugPresence,
} from "./http-auth.js";
import { instrumentMcpToolRegistration } from "./instrument-mcp.js";
import { registerMcpCatalogExtras } from "./mcp-catalog-extras.js";

import { registerAuthTools } from "./tools/auth.js";
import { registerDomainTools } from "./tools/domains.js";
import { registerUserTools } from "./tools/users.js";
import { registerProfileTools } from "./tools/profiles.js";
import { registerMailQueueTools } from "./tools/mail-queue.js";
import { registerReportTools } from "./tools/reports.js";
import { registerLogTools } from "./tools/logs.js";
import { registerSmtpTools } from "./tools/smtp.js";

async function initCache(): Promise<void> {
  const backend = process.env.FORTIMAIL_CACHE_BACKEND ?? "memory";

  if (backend === "redis") {
    const { Redis } = await import("ioredis");
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    const client = new Redis(redisUrl);
    setCache(new RedisCache(client));
    console.error(`[fortimail-mcp] Cache backend: Redis (${redisUrl})`);
  } else {
    setCache(new MemoryCache());
    console.error("[fortimail-mcp] Cache backend: in-memory");
  }
}

function buildServerInfo() {
  const title =
    process.env.MCP_SERVER_TITLE?.trim() || "Lynsoft AI Gateway for FortiMail";
  const websiteUrl =
    process.env.MCP_WEBSITE_URL?.trim() ||
    "https://www.fortinet.com/products/email-security/fortimail";
  const iconUrl = process.env.MCP_ICON_URL?.trim();
  return {
    name: "fortimail-mcp-server",
    version: "1.0.0",
    title,
    websiteUrl,
    ...(iconUrl
      ? {
          icons: [
            {
              src: iconUrl,
              mimeType: "image/png",
              sizes: ["512x512"],
            },
          ],
        }
      : {}),
  };
}

function createServer(): McpServer {
  const server = new McpServer(buildServerInfo());

  instrumentMcpToolRegistration(server);
  registerMcpCatalogExtras(server);

  registerAuthTools(server);
  registerDomainTools(server);
  registerUserTools(server);
  registerProfileTools(server);
  registerMailQueueTools(server);
  registerReportTools(server);
  registerLogTools(server);
  registerSmtpTools(server);

  return server;
}

async function runHTTP(): Promise<void> {
  const server = createServer();
  const app = express();
  app.use(express.json());

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(__dirname, "..", "public");
  app.use(express.static(publicDir, { maxAge: "7d" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "fortimail-mcp-server" });
  });

  // Gateways may GET /mcp first. If auth is required, return 401 (not 405) so clients discover Bearer.
  app.get("/mcp", (req, res) => {
    if (!isMcpHttpAuthorized(req.headers, req.query)) {
      if (process.env.MCP_HTTP_DEBUG_AUTH === "true") {
        console.error(
          "[fortimail-mcp] GET /mcp auth failed",
          mcpAuthDebugPresence(req.headers, req.query),
        );
      }
      res.setHeader("WWW-Authenticate", 'Bearer realm="fortimail-mcp"');
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.status(405).setHeader("Allow", "POST, OPTIONS").json({
      error: "Method Not Allowed",
      detail:
        "MCP Streamable HTTP: use POST /mcp with JSON-RPC. Successful POST responses stream as SSE (text/event-stream).",
    });
  });

  app.options("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST, OPTIONS");
    res.setHeader("Accept", "application/json");
    res.status(204).end();
  });

  app.post("/mcp", async (req, res) => {
    // Enforce MCP secret at the edge; clients send Bearer on initialize (Smithery / ChatGPT).
    if (!isMcpHttpAuthorized(req.headers, req.query)) {
      if (process.env.MCP_HTTP_DEBUG_AUTH === "true") {
        console.error(
          "[fortimail-mcp] POST /mcp auth failed",
          mcpAuthDebugPresence(req.headers, req.query),
        );
      }
      // RFC 9728 / MCP: 401 + WWW-Authenticate helps gateways (e.g. Smithery) detect Bearer auth.
      res.setHeader("WWW-Authenticate", 'Bearer realm="fortimail-mcp"');
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // Default: SSE streaming per MCP Streamable HTTP (omit enableJsonResponse).
    // enableJsonResponse: true forces a single application/json body and breaks clients that expect SSE.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.MCP_HTTP_HOST ?? "0.0.0.0";
  app.listen(port, host, () => {
    console.error(
      `[fortimail-mcp] Streamable HTTP server on http://${host}:${port}/mcp`,
    );
  });
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[fortimail-mcp] Server running via stdio");
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`
FortiMail MCP Server — Secure AI Gateway (Engine API client)

Environment variables:
  FORTIMAIL_ENGINE_URL    FortiMail Engine base URL including /v1 (required)
  FORTIMAIL_ENGINE_API_KEY  Engine API key (fme_..., Bearer) (required)
  FORTIMAIL_VERIFY_CERT   If "false", disable TLS verification for the engine (default: verify)
  FORTIMAIL_CACHE_BACKEND "memory" (default) or "redis"
  REDIS_URL               Redis URL when using redis cache
  TRANSPORT               "http" or "stdio" (default: stdio)
  PORT                    HTTP port (default: 3000)
  MCP_HTTP_HOST           Bind address for HTTP (default: 0.0.0.0)
  MCP_HTTP_BEARER_TOKEN   If set, require Authorization: Bearer for POST /mcp
  MCP_HTTP_API_KEY        If set, allow X-API-Key for POST /mcp
  MCP_SERVER_TITLE        MCP display title (default: Lynsoft AI Gateway for FortiMail)
  MCP_WEBSITE_URL         Homepage URL in MCP metadata (FortiMail product page by default)
  MCP_ICON_URL            Optional https URL to a PNG icon (512x512) for MCP metadata
  MCP_HTTP_DEBUG_AUTH     If "true", log which credential headers were present on 401 (no secrets)
`);
    process.exit(0);
  }

  await initCache();

  const transport = process.env.TRANSPORT ?? "stdio";
  if (transport === "http") {
    await runHTTP();
  } else {
    await runStdio();
  }
}

main().catch((err) => {
  console.error("[fortimail-mcp] Fatal error:", err);
  process.exit(1);
});
