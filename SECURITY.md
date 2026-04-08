# Security

## Reporting a vulnerability

Please report security issues privately (do not open a public issue for undisclosed vulnerabilities). Include:

- A description of the issue and potential impact
- Steps to reproduce or proof-of-concept
- Affected versions or commit, if known

We aim to acknowledge reports within a few business days.

## Trust boundaries

This MCP server is a **thin client** between an MCP host (e.g. Cursor, Claude Desktop) and the **FortiMail Engine** HTTP API. It does **not** hold FortiMail appliance admin passwords or perform `AdminLogin` to the appliance.

### API keys and the LLM

- **`FORTIMAIL_ENGINE_API_KEY`** is read by the **MCP server process** and sent as `Authorization: Bearer` to the engine. It is **not** part of the MCP tool schema and is **not** sent to the model as part of ordinary tool requests or responses.
- **What the model can see:** Tool names, arguments (e.g. domain names, queue types), and **returned text** from tools. **Do not** paste API keys into chat or commit them to git.

### Transport

- **stdio**: The MCP process runs on the operator’s machine. Traffic goes to the **FortiMail Engine** (HTTPS) and optionally **Redis** if `FORTIMAIL_CACHE_BACKEND=redis`.
- **HTTP**: Set **`MCP_HTTP_BEARER_TOKEN`** and/or **`MCP_HTTP_API_KEY`** for any deployment reachable outside localhost. Put TLS (reverse proxy), VPN, or firewall in front for production.

### Redis

If you use Redis for the MCP response cache, restrict network access and authenticate Redis in production.

## Out of scope

FortiMail appliance hardening and engine deployment policies are outside this repository. Insufficient API key scopes or engine policy still result in errors (e.g. HTTP 401/403).
