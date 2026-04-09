# FortiMail MCP Server

**Secure AI Gateway for FortiMail** — open-source MCP server that speaks only to the **FortiMail Engine** HTTP API (`/v1`, Bearer API keys). It does **not** connect directly to a FortiMail appliance or store appliance admin passwords.

**License:** [MIT](LICENSE). Security disclosures: [SECURITY.md](SECURITY.md).

## Features

- **40+ tools** mapped to the [FortiMail Engine OpenAPI](openapi/openapi.json) (`pnpm run codegen` regenerates TypeScript types)
- **Bearer-only upstream auth** — `fme_...` API keys with engine-side scopes (`fortimail:read` / `fortimail:write`, etc.)
- **Dual-backend caching** — in-memory (default) or Redis, with per-resource TTLs (MCP response cache only)
- **Retry with exponential backoff** — transient HTTP errors
- **TLS** — verify by default; set `FORTIMAIL_VERIFY_CERT=false` only when appropriate
- **Dual transport** — Streamable HTTP (remote) or stdio (local)
- **Input validation** — Zod schemas on every tool
- **Truncation safety** — ~25K character cap on tool output (final gate for LLM context)
- **Optional HTTP authentication** — Bearer token and/or API key for `POST /mcp`

## Architecture (thin client)

| Layer | Role |
|-------|------|
| **This repo** | Auditable MCP "driver": maps tools → Engine REST paths, adds caching and truncation |
| **FortiMail Engine** (proprietary) | Policy, FortiMail quirks, rate limits, optional multi-tenant routing |
| **FortiMail appliance** | Reached only by the engine, not by this MCP process |

Upstream contract: vendored [`openapi/openapi.json`](openapi/openapi.json). When the engine API changes, refresh that file and run `pnpm run codegen`.

## What the AI can do for you

| Workflow | Example prompt | Tools involved |
|----------|----------------|----------------|
| **Engine health** | "Check FortiMail Engine status with detailed readiness" | `fortimail.engine.status` |
| **Queue triage** | "List the incoming queue, then show full headers for mkey …" | `fortimail.queue.list`, `fortimail.queue.view` |
| **Redirect stuck mail** | "Search the deferred queue for recipient X, reroute to backup.example.com" | `fortimail.queue.search`, `fortimail.queue.reroute` |
| **Log investigation** | "List elog files, download the segment …" | `fortimail.logs.list`, `fortimail.logs.download` |
| **Reporting** | "List reports, trigger mail stats for task Daily_Stats" | `fortimail.reports.list`, `fortimail.reports.generate.mail_stats` |

## Security model

| Mode | Notes |
|------|--------|
| **stdio** | MCP runs on the operator machine. **`FORTIMAIL_ENGINE_API_KEY`** is process env — not passed to the model in normal tool flows. |
| **HTTP** | Protect `POST /mcp` with **`MCP_HTTP_BEARER_TOKEN`** and/or **`MCP_HTTP_API_KEY`** when not on localhost. |

**Threat model:** Anyone who can call `/mcp` with valid HTTP auth can do whatever the **engine API key** allows. Protect Redis if used. See [SECURITY.md](SECURITY.md).

## Quick Start

```bash
pnpm install
pnpm run build
pnpm test
```

Required environment:

```bash
FORTIMAIL_ENGINE_URL=https://your-engine.example.com/v1
FORTIMAIL_ENGINE_API_KEY=fme_your_key
```

Example `.env.local`:

```bash
FORTIMAIL_ENGINE_URL=https://engine.example.com/v1
FORTIMAIL_ENGINE_API_KEY=fme_...
# FORTIMAIL_VERIFY_CERT=false   # only if engine uses a private CA / self-signed cert
```

Run:

```bash
pnpm start
# HTTP + MCP auth
TRANSPORT=http PORT=3000 MCP_HTTP_BEARER_TOKEN=secret pnpm start
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FORTIMAIL_ENGINE_URL` | **Yes** | — | Engine base URL **including `/v1`** |
| `FORTIMAIL_ENGINE_API_KEY` | **Yes** | — | Bearer token (`fme_...`) |
| `FORTIMAIL_VERIFY_CERT` | No | verify | Set `false` to skip TLS verification (dev only) |
| `FORTIMAIL_CACHE_BACKEND` | No | `memory` | `memory` or `redis` |
| `REDIS_URL` | No | `redis://127.0.0.1:6379` | Redis URL |
| `TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `PORT` | No | `3000` | HTTP port |
| `MCP_HTTP_HOST` | No | `0.0.0.0` | Bind address for HTTP |
| `MCP_HTTP_BEARER_TOKEN` | No | — | If set, `POST /mcp` requires `Authorization: Bearer` |
| `MCP_HTTP_API_KEY` | No | — | If set, `POST /mcp` may use `X-API-Key` |

## Authentication tools

- **`fortimail.engine.status`** — liveness (`GET /health`); optional detailed readiness (`GET /health/detailed`, Bearer). Both are requested at the **engine origin** (same host/port as `FORTIMAIL_ENGINE_URL` with `/v1` stripped), not under `/v1`.
- **`fortimail.auth.logout`** — no-op (legacy name; engine uses API keys only).
- **`fortimail.cache.flush`** — clears MCP response cache (not the engine server cache).

## Publishing to MCP directories (e.g. [Smithery](https://smithery.ai/docs/build/publish))

This server matches Smithery’s **URL** publishing expectations:

| Requirement | How this repo satisfies it |
|-------------|----------------------------|
| Streamable HTTP | `POST /mcp` with `@modelcontextprotocol/sdk` `StreamableHTTPServerTransport` (SSE `text/event-stream` responses — not single JSON) |
| Auth | If you set `MCP_HTTP_BEARER_TOKEN`, clients must send the same secret. Accepted: `Authorization: Bearer …`, header **`X-MCP-Bearer-Token`** (Smithery session `x-from`), or query `?mcp_bearer_token=` |
| 401 for missing auth | Unauthenticated `POST /mcp` returns **401** with `WWW-Authenticate: Bearer realm="fortimail-mcp"` (not 403) |
| Config schema | `smithery-config-schema.json` — republish with `--config-schema "$(cat smithery-config-schema.json)"` |

**If Smithery or another gateway shows “couldn’t authenticate with the upstream server”:** the gateway is calling your URL **without** a valid MCP secret. Set **`MCP_HTTP_BEARER_TOKEN`** on the host to match the value users enter in Smithery (or Cursor / ChatGPT connector) for **MCP Bearer Token**. Optional fields in the JSON Schema do **not** remove the need for that token when the server enforces HTTP auth.

**Cloudflare / WAF:** allow `SmitheryBot` and skip JS challenges on `POST /mcp` so scans succeed ([Smithery troubleshooting](https://smithery.ai/docs/build/publish#403-forbidden-during-scan)). For MCP, also **disable caching and response buffering** on `/mcp` so **SSE streams** are not broken.


**Reverse proxy (Traefik / nginx / Dokploy):** The upstream **must** receive the same credential headers the client sends. If `Authorization` is stripped, configure the proxy to forward it, or have the gateway send **`X-MCP-Bearer-Token`** (supported by this server). Some setups copy the client `Authorization` into **`X-Forwarded-Authorization`** — that is supported when the primary `Authorization` header is missing.

**Still failing:** Set `MCP_HTTP_DEBUG_AUTH=true` on the container and retry from ChatGPT; check logs for `hasAuthorization` / `hasXMcpBearerToken` / `queryKeys` (no secrets logged). If all are `false`, the gateway is not forwarding credentials to your origin.

- **Name:** `fortimail-mcp-server`
- **Description:** MCP client for FortiMail Engine API — domains, users, profiles, queue, reports, logs, SMTP
- **Required env (process):** `FORTIMAIL_ENGINE_URL`, `FORTIMAIL_ENGINE_API_KEY`
- **Transports:** `stdio`, Streamable HTTP (`POST /mcp` streams SSE; `GET /mcp` returns 401 without auth, else 405 with hint)

### HTTP mode for Cursor / ChatGPT / Claude (remote URL)

Point the client at `https://your-host/mcp` and configure the **same** secret the server expects:

- **Authorization:** `Bearer <MCP_HTTP_BEARER_TOKEN>`, or  
- **Header:** `X-MCP-Bearer-Token: <MCP_HTTP_BEARER_TOKEN>` (matches Smithery `mcp_bearer_token` / `x-mcp-bearer-token`), or  
- **Query:** `?mcp_bearer_token=<token>` (less ideal; may appear in logs)

## MSP and multi-instance

**One process = one engine base URL + one API key.** For many tenants or appliances, run **multiple MCP instances** (or let the **engine** multiplex tenants — the MCP only forwards the Bearer token). See [docs/MULTI_INSTANCE.md](docs/MULTI_INSTANCE.md).

## Licensing and commercial roadmap

- **Open core:** MIT ([LICENSE](LICENSE)).
- **Engine:** The FortiMail Engine service that implements `openapi.json` may be proprietary; this repo stays a thin OSS client.

Contributions: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).

## Tool inventory

### Engine & cache (3 tools)
- `fortimail.engine.status` / `fortimail.auth.logout` / `fortimail.cache.flush`

### Domains (7 tools)
- `fortimail.domains.list` / `fortimail.domains.get` / `fortimail.domains.create` / `fortimail.domains.update` / `fortimail.domains.delete`
- `fortimail.domains.info.get` / `fortimail.domains.info.update`

### Users (10 tools)
- Mail users: `fortimail.users.list` / `.get` / `.create` / `.update` / `.delete`
- User maps: `fortimail.users.maps.list` / `.get` / `.create` / `.update` / `.delete`

### Profiles (20 tools)
- GeoIP, Notification, IMAP auth, SMTP auth — CRUD each (e.g. `fortimail.profiles.geoip.list`)

### Mail queue (6 tools)
- `fortimail.queue.list` / `.search` / `.view` / `.delete` / `.reroute` / `.download`

### Reports (6), Logs (2), SMTP (2)
- `fortimail.reports.*`, `fortimail.logs.*`, `fortimail.smtp.config.*`

## Repository layout

```
src/
├── index.ts
├── constants.ts
├── text-utils.ts
├── generated/engine-schema.ts   # pnpm run codegen
├── engine/unwrap.ts
├── services/api-client.ts      # EngineClient (Bearer)
└── tools/
```

## MCP client configuration (stdio)

```json
{
  "mcpServers": {
    "fortimail": {
      "command": "node",
      "args": ["/path/to/fortimail-mcp-server/dist/index.js"],
      "env": {
        "FORTIMAIL_ENGINE_URL": "https://engine.example.com/v1",
        "FORTIMAIL_ENGINE_API_KEY": "fme_..."
      }
    }
  }
}
```

### HTTP mode

```bash
TRANSPORT=http PORT=3000 MCP_HTTP_BEARER_TOKEN=your-secret node dist/index.js
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `pnpm test` before submitting changes. After updating `openapi/openapi.json`, run `pnpm run codegen`.
