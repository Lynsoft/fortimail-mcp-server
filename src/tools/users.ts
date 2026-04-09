/**
 * Users — FortiMail Engine `/v1/domains/.../users` and `/v1/user-maps`.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CACHE_TTL, CHARACTER_LIMIT } from "../constants.js";
import { unwrapList } from "../engine/unwrap.js";
import { getClient, handleApiError } from "../services/api-client.js";

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n…(truncated)";
}

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    "fortimail.users.list",
    {
      title: "List Mail Users",
      description:
        "**Purpose:** List mailbox users for a domain (`GET /v1/domains/{domain}/users`).\n" +
        "**Inputs:** `domain`.\n" +
        "**Returns:** Markdown summary.\n" +
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
        const data = await client.get<unknown>(
          `/domains/${encodeURIComponent(domain)}/users`,
          undefined,
          CACHE_TTL.USER,
        );
        const users = unwrapList<{
          mkey?: string;
          displayname?: string;
          status?: string;
          type?: string;
        }>(data);
        let text = `# Mail Users for ${domain} (${users.length})\n\n`;
        for (const u of users) {
          text += `- **${u.mkey ?? "?"}** — display: ${u.displayname ?? "—"}, status: ${u.status ?? "—"}, type: ${u.type ?? "—"}\n`;
        }
        return { content: [{ type: "text", text: truncate(text) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.get",
    {
      title: "Get Mail User",
      description:
        "**Purpose:** Fetch one user (`GET /v1/domains/{domain}/users/{key}`).\n" +
        "**Inputs:** `domain`; `key` — user mkey.\n" +
        "**Side effects:** None (read-only).",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name"),
        key: z.string().min(1).describe("User mkey"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain, key }) => {
      try {
        const client = getClient();
        const data = await client.get<unknown>(
          `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(key)}`,
          undefined,
          CACHE_TTL.USER,
        );
        return { content: [{ type: "text", text: truncate(JSON.stringify(data, null, 2)) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.create",
    {
      title: "Create Mail User",
      description:
        "**Purpose:** Create mailbox user (`POST /v1/domains/{domain}/users/{key}`).\n" +
        "**Inputs:** `domain`; `key`; optional `settings` — password, status, type, displayname (see engine OpenAPI).\n" +
        "**Side effects:** Flushes MCP cache.",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name"),
        key: z.string().min(1).describe("Username / mkey"),
        settings: z.record(z.unknown()).optional().describe("User fields"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ domain, key, settings }) => {
      try {
        const client = getClient();
        const res = await client.post(
          `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(key)}`,
          settings ?? {},
        );
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(`Mail user '${key}@${domain}' created.\n${JSON.stringify(res, null, 2)}`),
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.update",
    {
      title: "Update Mail User",
      description:
        "**Purpose:** `PUT /v1/domains/{domain}/users/{key}`.\n" +
        "**Side effects:** Flushes MCP cache.",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name"),
        key: z.string().min(1).describe("User mkey"),
        settings: z.record(z.unknown()).describe("Fields to update"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain, key, settings }) => {
      try {
        const client = getClient();
        const res = await client.put(
          `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(key)}`,
          settings,
        );
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(`User '${key}@${domain}' updated.\n${JSON.stringify(res, null, 2)}`),
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.delete",
    {
      title: "Delete Mail User",
      description: "**Purpose:** `DELETE /v1/domains/{domain}/users/{key}`.\n**Side effects:** Flushes MCP cache.",
      inputSchema: {
        domain: z.string().min(1).describe("Domain name"),
        key: z.string().min(1).describe("User mkey"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ domain, key }) => {
      try {
        const client = getClient();
        await client.delete(`/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(key)}`);
        await client.flushCache();
        return { content: [{ type: "text", text: `Mail user '${key}@${domain}' deleted.` }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.maps.list",
    {
      title: "List User Maps",
      description: "**Purpose:** `GET /v1/user-maps`.\n**Side effects:** None (read-only).",
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
        const data = await client.get<unknown>("/user-maps", undefined, CACHE_TTL.USER);
        const maps = unwrapList<Record<string, unknown>>(data);
        let text = `# User Maps (${maps.length})\n\n`;
        for (const m of maps) {
          const mk = typeof m.mkey === "string" ? m.mkey : JSON.stringify(m);
          const ext = m.external_name ?? m.externalName ?? "—";
          text += `- **${mk}** → ${String(ext)}\n`;
        }
        return { content: [{ type: "text", text: truncate(text) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.maps.get",
    {
      title: "Get User Map",
      description:
        "**Purpose:** Find one map by listing `/v1/user-maps` (no single-GET in OpenAPI).\n" +
        "**Inputs:** `key` — internal mkey.\n" +
        "**Side effects:** None (read-only).",
      inputSchema: { key: z.string().min(1).describe("Internal user name (mkey)") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ key }) => {
      try {
        const client = getClient();
        const data = await client.get<unknown>(
          "/user-maps",
          { limit: 200, offset: 0 },
          CACHE_TTL.USER,
        );
        const maps = unwrapList<Record<string, unknown>>(data);
        const found = maps.find(
          (m) => m.mkey === key || String(m.mkey) === key,
        );
        if (!found) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: User map '${key}' not found in first 200 entries.` }],
          };
        }
        return { content: [{ type: "text", text: truncate(JSON.stringify(found, null, 2)) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.maps.create",
    {
      title: "Create User Map",
      description:
        "**Purpose:** `POST /v1/user-maps/{key}`. Body must include `type` per engine schema; pass `map_type` or full `body`.\n" +
        "**Side effects:** Flushes MCP cache.",
      inputSchema: {
        key: z.string().min(1).describe("Internal user name"),
        map_type: z.string().optional().describe("Engine `type` field (required by API)"),
        external_name: z.string().optional().describe("External mapping"),
        extra: z.record(z.unknown()).optional().describe("Additional JSON fields for engine"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ key, map_type, external_name, extra }) => {
      try {
        const client = getClient();
        const body: Record<string, unknown> = {
          type: map_type ?? "user_map",
          ...(external_name !== undefined ? { external_name } : {}),
          ...(extra ?? {}),
        };
        const res = await client.post(`/user-maps/${encodeURIComponent(key)}`, body);
        await client.flushCache();
        return {
          content: [
            { type: "text", text: truncate(`User map '${key}' created.\n${JSON.stringify(res, null, 2)}`) },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.maps.update",
    {
      title: "Update User Map",
      description: "**Purpose:** `PUT /v1/user-maps/{key}`.\n**Side effects:** Flushes MCP cache.",
      inputSchema: {
        key: z.string().min(1).describe("Internal user name (mkey)"),
        settings: z.record(z.unknown()).describe("Fields to update"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ key, settings }) => {
      try {
        const client = getClient();
        const res = await client.put(`/user-maps/${encodeURIComponent(key)}`, settings);
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(`User map '${key}' updated.\n${JSON.stringify(res, null, 2)}`),
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.users.maps.delete",
    {
      title: "Delete User Map",
      description: "**Purpose:** `DELETE /v1/user-maps/{key}`.\n**Side effects:** Flushes MCP cache.",
      inputSchema: { key: z.string().min(1).describe("Internal user name (mkey)") },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ key }) => {
      try {
        const client = getClient();
        await client.delete(`/user-maps/${encodeURIComponent(key)}`);
        await client.flushCache();
        return { content: [{ type: "text", text: `User map '${key}' deleted.` }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );
}
