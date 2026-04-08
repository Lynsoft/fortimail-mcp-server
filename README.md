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
| **This repo** | Auditable MCP “driver”: maps tools → Engine REST paths, adds caching and truncation |
| **FortiMail Engine** (proprietary) | Policy, FortiMail quirks, rate limits, optional multi-tenant routing |
| **FortiMail appliance** | Reached only by the engine, not by this MCP process |

Upstream contract: vendored [`openapi/openapi.json`](openapi/openapi.json). When the engine API changes, refresh that file and run `pnpm run codegen`.

## What the AI can do for you

| Workflow | Example prompt | Tools involved |
|----------|----------------|----------------|
| **Engine health** | “Check FortiMail Engine status with detailed readiness” | `fortimail_engine_status` |
| **Queue triage** | “List the incoming queue, then show full headers for mkey …” | `fortimail_list_mail_queue`, `fortimail_view_queued_mail` |
| **Redirect stuck mail** | “Search the deferred queue for recipient X, reroute to backup.example.com” | `fortimail_search_mail_queue`, `fortimail_send_to_alternate_host` |
| **Log investigation** | “List elog files, download the segment …” | `fortimail_list_log_files`, `fortimail_download_log` |
| **Reporting** | “List reports, trigger mail stats for task Daily_Stats” | `fortimail_list_reports`, `fortimail_generate_mail_stats_report` |

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

- **`fortimail_engine_status`** — liveness (`/health`); optional detailed readiness (`/health/detailed`, Bearer).
- **`fortimail_logout`** — no-op (legacy name; engine uses API keys only).
- **`fortimail_flush_cache`** — clears MCP response cache (not the engine server cache).

## Publishing to MCP directories

- **Name:** `fortimail-mcp-server`
- **Description:** MCP client for FortiMail Engine API — domains, users, profiles, queue, reports, logs, SMTP
- **Required env:** `FORTIMAIL_ENGINE_URL`, `FORTIMAIL_ENGINE_API_KEY`
- **Transports:** `stdio`, Streamable HTTP (`POST /mcp`)

## MSP and multi-instance

**One process = one engine base URL + one API key.** For many tenants or appliances, run **multiple MCP instances** (or let the **engine** multiplex tenants — the MCP only forwards the Bearer token). See [docs/MULTI_INSTANCE.md](docs/MULTI_INSTANCE.md).

## Licensing and commercial roadmap

- **Open core:** MIT ([LICENSE](LICENSE)).
- **Engine:** The FortiMail Engine service that implements `openapi.json` may be proprietary; this repo stays a thin OSS client.

Contributions: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).

## Tool inventory

### Authentication (3 tools)
- `fortimail_engine_status` / `fortimail_logout` / `fortimail_flush_cache`

### Domains (7 tools)
- `fortimail_list_domains` / `fortimail_get_domain` / `fortimail_create_domain` / `fortimail_update_domain` / `fortimail_delete_domain`
- `fortimail_get_domain_info` / `fortimail_update_domain_info`

### Users (10 tools)
- Mail users: list / get / create / update / delete
- User maps: list / get / create / update / delete

### Profiles (20 tools)
- GeoIP, Notification, IMAP auth, SMTP auth — CRUD each

### Mail queue (6 tools)
- `fortimail_download_queued_mail` returns a **not available** message until the engine exposes an equivalent route

### Reports (6), Logs (2), SMTP (2)
- As in previous releases, mapped to `/v1/reports`, `/v1/logs`, `/v1/smtp-config`

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
