/**
 * Profiles — geo, notifications, IMAP/SMTP auth (FortiMail Engine OpenAPI).
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

interface ProfileSpec {
  prefix: string;
  label: string;
  domainScoped: boolean;
  listPath: (domain?: string) => string;
  itemPath: (domain: string | undefined, key: string) => string;
}

function registerProfileCrud(server: McpServer, spec: ProfileSpec): void {
  const domainInput: z.ZodRawShape = spec.domainScoped
    ? { domain: z.string().min(1).describe("Domain name") }
    : {};

  server.registerTool(
    `fortimail.profiles.${spec.prefix}.list`,
    {
      title: `List ${spec.label}s`,
      description:
        `**Purpose:** List ${spec.label} profiles via the engine.\n` +
        "**Side effects:** None (read-only).",
      inputSchema: { ...domainInput },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args: { domain?: string }) => {
      try {
        const client = getClient();
        if (spec.domainScoped && !args.domain) {
          return { isError: true, content: [{ type: "text", text: "Error: domain is required." }] };
        }
        const data = await client.get<unknown>(
          spec.listPath(args.domain),
          undefined,
          CACHE_TTL.PROFILE,
        );
        const items = unwrapList<Record<string, unknown>>(data);
        let text = `# ${spec.label}s (${items.length})\n\n`;
        for (const item of items) {
          const mk = typeof item.mkey === "string" ? item.mkey : "?";
          text += `- **${mk}** — ${String(item.comment ?? item.server ?? "")}\n`;
        }
        return { content: [{ type: "text", text: truncate(text) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    `fortimail.profiles.${spec.prefix}.get`,
    {
      title: `Get ${spec.label}`,
      description: `**Purpose:** Get one ${spec.label}.`,
      inputSchema: {
        ...domainInput,
        key: z.string().min(1).describe("Profile mkey"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args: { domain?: string; key: string }) => {
      try {
        const client = getClient();
        if (spec.domainScoped && !args.domain) {
          return { isError: true, content: [{ type: "text", text: "Error: domain is required." }] };
        }
        const data = await client.get<unknown>(
          spec.itemPath(args.domain, args.key),
          undefined,
          CACHE_TTL.PROFILE,
        );
        return { content: [{ type: "text", text: truncate(JSON.stringify(data, null, 2)) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    `fortimail.profiles.${spec.prefix}.create`,
    {
      title: `Create ${spec.label}`,
      description: `**Purpose:** Create ${spec.label} (see engine OpenAPI for required body fields).`,
      inputSchema: {
        ...domainInput,
        key: z.string().min(1).describe("Profile mkey"),
        settings: z.record(z.unknown()).optional().describe("Request body"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args: { domain?: string; key: string; settings?: Record<string, unknown> }) => {
      try {
        const client = getClient();
        if (spec.domainScoped && !args.domain) {
          return { isError: true, content: [{ type: "text", text: "Error: domain is required." }] };
        }
        const res = await client.post(
          spec.itemPath(args.domain, args.key),
          args.settings ?? {},
        );
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(`${spec.label} '${args.key}' created.\n${JSON.stringify(res, null, 2)}`),
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    `fortimail.profiles.${spec.prefix}.update`,
    {
      title: `Update ${spec.label}`,
      description: `**Purpose:** Update ${spec.label}.`,
      inputSchema: {
        ...domainInput,
        key: z.string().min(1).describe("Profile mkey"),
        settings: z.record(z.unknown()).describe("Fields to update"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args: { domain?: string; key: string; settings: Record<string, unknown> }) => {
      try {
        const client = getClient();
        if (spec.domainScoped && !args.domain) {
          return { isError: true, content: [{ type: "text", text: "Error: domain is required." }] };
        }
        const res = await client.put(spec.itemPath(args.domain, args.key), args.settings);
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: truncate(`${spec.label} '${args.key}' updated.\n${JSON.stringify(res, null, 2)}`),
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    `fortimail.profiles.${spec.prefix}.delete`,
    {
      title: `Delete ${spec.label}`,
      description: `**Purpose:** Delete ${spec.label}.`,
      inputSchema: {
        ...domainInput,
        key: z.string().min(1).describe("Profile mkey"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args: { domain?: string; key: string }) => {
      try {
        const client = getClient();
        if (spec.domainScoped && !args.domain) {
          return { isError: true, content: [{ type: "text", text: "Error: domain is required." }] };
        }
        await client.delete(spec.itemPath(args.domain, args.key));
        await client.flushCache();
        return { content: [{ type: "text", text: `${spec.label} '${args.key}' deleted.` }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );
}

export function registerProfileTools(server: McpServer): void {
  registerProfileCrud(server, {
    prefix: "geoip",
    label: "GeoIP Profile",
    domainScoped: false,
    listPath: () => "/geo-profiles",
    itemPath: (_d, key) => `/geo-profiles/${encodeURIComponent(key)}`,
  });

  registerProfileCrud(server, {
    prefix: "notification",
    label: "Notification Profile",
    domainScoped: true,
    listPath: (d) => `/domains/${encodeURIComponent(d!)}/notifications`,
    itemPath: (d, key) =>
      `/domains/${encodeURIComponent(d!)}/notifications/${encodeURIComponent(key)}`,
  });

  registerProfileCrud(server, {
    prefix: "imap_auth",
    label: "IMAP Auth Profile",
    domainScoped: true,
    listPath: (d) => `/domains/${encodeURIComponent(d!)}/auth/imap`,
    itemPath: (d, key) =>
      `/domains/${encodeURIComponent(d!)}/auth/imap/${encodeURIComponent(key)}`,
  });

  registerProfileCrud(server, {
    prefix: "smtp_auth",
    label: "SMTP Auth Profile",
    domainScoped: true,
    listPath: (d) => `/domains/${encodeURIComponent(d!)}/auth/smtp`,
    itemPath: (d, key) =>
      `/domains/${encodeURIComponent(d!)}/auth/smtp/${encodeURIComponent(key)}`,
  });
}
