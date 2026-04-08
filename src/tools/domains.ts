/**
 * Domain management — FortiMail Engine `/v1/domains` API.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CACHE_TTL, CHARACTER_LIMIT } from "../constants.js";
import { unwrapList } from "../engine/unwrap.js";
import { getClient, handleApiError } from "../services/api-client.js";
import type { DomainInfo } from "../types.js";

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n…(truncated)";
}

export function registerDomainTools(server: McpServer): void {
  server.registerTool(
    "fortimail_list_domains",
    {
      title: "List Domains",
      description:
        "**Purpose:** Enumerate mail domains via the FortiMail Engine.\n" +
        "**When to use:** Onboarding, audits, or before editing a domain.\n" +
        "**Inputs:** None.\n" +
        "**Returns:** Markdown list; truncated if very large.\n" +
        "**Side effects:** None (read-only).",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const client = getClient();
        const data = await client.get<unknown>("/domains", undefined, CACHE_TTL.DOMAIN);
        const domains = unwrapList<{
          mkey?: string;
          ip?: string;
          port?: number;
          subdomain?: string;
          status?: string;
        }>(data);
        let text = `# Domains (${domains.length})\n\n`;
        for (const d of domains) {
          text += `- **${d.mkey ?? "?"}** — IP: ${d.ip ?? "—"}, port: ${d.port ?? "—"}, subdomain: ${d.subdomain ?? "—"}, status: ${d.status ?? "—"}\n`;
        }
        return { content: [{ type: "text", text: truncate(text) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    },
  );

  server.registerTool(
    "fortimail_get_domain",
    {
      title: "Get Domain Settings",
      description:
        "**Purpose:** Load configuration for one domain.\n" +
        "**Inputs:** `domain` — domain name (mkey).\n" +
        "**Returns:** JSON.\n" +
        "**Side effects:** None (read-only).",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name (mkey)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain }) => {
      try {
        const client = getClient();
        const data = await client.get<unknown>(
          `/domains/${encodeURIComponent(domain)}`,
          undefined,
          CACHE_TTL.DOMAIN,
        );
        return {
          content: [{ type: "text", text: truncate(JSON.stringify(data, null, 2)) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    },
  );

  server.registerTool(
    "fortimail_create_domain",
    {
      title: "Create Domain",
      description:
        "**Purpose:** Create a domain via the engine (`POST /v1/domains/{key}`).\n" +
        "**Inputs:** `domain` — name; `settings` — must include `ip` per engine schema; optional port, status, comment.\n" +
        "**Returns:** API response body.\n" +
        "**Side effects:** Creates domain; flushes MCP cache.",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name to create"),
        settings: z
          .record(z.unknown())
          .optional()
          .describe("Engine body (required: ip)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ domain, settings }) => {
      try {
        const client = getClient();
        const res = await client.post(
          `/domains/${encodeURIComponent(domain)}`,
          settings ?? {},
        );
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(`Domain '${domain}' created.\n${JSON.stringify(res, null, 2)}`),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    },
  );

  server.registerTool(
    "fortimail_update_domain",
    {
      title: "Update Domain Settings",
      description:
        "**Purpose:** Partial update (`PUT /v1/domains/{key}`).\n" +
        "**Inputs:** `domain`; `settings` — fields to update.\n" +
        "**Returns:** API response body.\n" +
        "**Side effects:** Updates domain; flushes MCP cache.",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name"),
        settings: z.record(z.unknown()).describe("Fields to update"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain, settings }) => {
      try {
        const client = getClient();
        const res = await client.put(`/domains/${encodeURIComponent(domain)}`, settings);
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(`Domain '${domain}' updated.\n${JSON.stringify(res, null, 2)}`),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    },
  );

  server.registerTool(
    "fortimail_delete_domain",
    {
      title: "Delete Domain",
      description:
        "**Purpose:** Delete a domain (`DELETE /v1/domains/{key}`).\n" +
        "**Inputs:** `domain`.\n" +
        "**Side effects:** Destructive; flushes MCP cache.",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ domain }) => {
      try {
        const client = getClient();
        await client.delete(`/domains/${encodeURIComponent(domain)}`);
        await client.flushCache();
        return {
          content: [{ type: "text", text: `Domain '${domain}' deleted successfully.` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    },
  );

  server.registerTool(
    "fortimail_get_domain_info",
    {
      title: "Get Domain Info",
      description:
        "**Purpose:** Customer/account metadata (`GET /v1/domain-info/{key}`).\n" +
        "**Inputs:** `domain`.\n" +
        "**Returns:** JSON.\n" +
        "**Side effects:** None (read-only).",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain }) => {
      try {
        const client = getClient();
        const data = await client.get<DomainInfo>(
          `/domain-info/${encodeURIComponent(domain)}`,
          undefined,
          CACHE_TTL.DOMAIN,
        );
        return {
          content: [{ type: "text", text: truncate(JSON.stringify(data, null, 2)) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    },
  );

  server.registerTool(
    "fortimail_update_domain_info",
    {
      title: "Update Domain Info",
      description:
        "**Purpose:** Update metadata (`PUT /v1/domain-info/{key}`).\n" +
        "**Inputs:** `domain`; `info` — customer_name, customer_email, account_limit, comment.\n" +
        "**Side effects:** Flushes MCP cache.",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name"),
        info: z.record(z.unknown()).describe("Fields to update"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain, info }) => {
      try {
        const client = getClient();
        const res = await client.put(`/domain-info/${encodeURIComponent(domain)}`, info);
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(
                `Domain info for '${domain}' updated.\n${JSON.stringify(res, null, 2)}`,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: handleApiError(error) }],
        };
      }
    },
  );
}
