# Multi-instance and MSP deployments

This MCP server is a **single-tenant thin client**: one OS process uses one **`FORTIMAIL_ENGINE_URL`** and one **`FORTIMAIL_ENGINE_API_KEY`**.

## Recommended pattern

Run **one MCP server instance per engine tenant** (or per distinct customer) — separate Cursor MCP entries, containers, or HTTP ports. Each instance gets its own API key and env block.

**Many tenants in one engine:** Prefer issuing **per-tenant API keys** in the FortiMail Engine and running one MCP process per key. The engine may route each key to FortiMail instance(s); that logic lives in the engine, not in this repo.

## Redis

If you use Redis for MCP response caching, **do not share one Redis namespace** across untrusted tenants unless you isolate keys (e.g. different prefixes per deployment). Prefer separate Redis instances or separate databases per customer for MSP isolation.

## Future

A single MCP binary with an `instance` parameter would require a **registry** of engine URLs/keys and careful cache isolation. That is **not** implemented here.
