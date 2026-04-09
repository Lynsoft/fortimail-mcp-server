/**
 * SMTP configuration — FortiMail Engine `/v1/smtp-config`.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CACHE_TTL } from "../constants.js";
import { getClient, handleApiError } from "../services/api-client.js";

export function registerSmtpTools(server: McpServer): void {
  server.registerTool(
    "fortimail.smtp.config.get",
    {
      title: "Get SMTP Configuration",
      description: "**Purpose:** `GET /v1/smtp-config`.",
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
        const data = await client.get<unknown>("/smtp-config", undefined, CACHE_TTL.SMTP_CONFIG);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
    "fortimail.smtp.config.update",
    {
      title: "Update SMTP Configuration",
      description: "**Purpose:** `PUT /v1/smtp-config`.",
      inputSchema: {
        settings: z.record(z.unknown()).describe("Fields to update (e.g. proxy_original)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ settings }) => {
      try {
        const client = getClient();
        const res = await client.put("/smtp-config", settings);
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: `SMTP configuration updated.\n${JSON.stringify(res, null, 2)}`,
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
