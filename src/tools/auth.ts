/**
 * Engine connectivity and MCP response cache tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, handleApiError } from "../services/api-client.js";

export function registerAuthTools(server: McpServer): void {
  server.registerTool(
    "fortimail_engine_status",
    {
      title: "FortiMail Engine Status",
      description:
        "**Purpose:** Check connectivity to the FortiMail Engine (liveness and optional detailed readiness).\n" +
        "**When to use:** After configuring env vars, or when other tools fail with network/auth errors.\n" +
        "**Inputs:** `detailed` — if true, call `/health/detailed` (requires API key with sufficient scope).\n" +
        "**Returns:** JSON from the engine health endpoints.\n" +
        "**Side effects:** None.",
      inputSchema: {
        detailed: z
          .boolean()
          .optional()
          .describe("If true, include detailed readiness (Bearer required)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ detailed }) => {
      try {
        const client = getClient();
        const live = await client.getLiveness();
        if (detailed) {
          const ready = await client.getReadiness();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ liveness: live, detailed: ready }, null, 2),
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(live, null, 2) }],
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
    "fortimail_logout",
    {
      title: "FortiMail Logout (no-op)",
      description:
        "**Purpose:** Legacy tool name. Engine mode uses Bearer tokens only — there is no server-side MCP session to end.\n" +
        "**Returns:** Short confirmation.\n" +
        "**Side effects:** None.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text:
            "No session to end: this MCP uses a FortiMail Engine API key (Bearer) only. " +
            "Rotate or revoke keys in the engine if access must be withdrawn.",
        },
      ],
    }),
  );

  server.registerTool(
    "fortimail_flush_cache",
    {
      title: "Flush MCP Response Cache",
      description:
        "**Purpose:** Clear the MCP process response cache (in-memory or Redis), not the FortiMail Engine server cache.\n" +
        "**When to use:** When reads look stale after changes made elsewhere.\n" +
        "**Returns:** Confirmation.\n" +
        "**Side effects:** Next reads refetch from the engine.",
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const client = getClient();
        await client.flushCache();
        return {
          content: [{ type: "text", text: "MCP response cache flushed successfully." }],
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
