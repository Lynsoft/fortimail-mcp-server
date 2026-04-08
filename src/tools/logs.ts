/**
 * Logs — FortiMail Engine `/v1/logs` API.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CACHE_TTL, CHARACTER_LIMIT, DEFAULT_PAGE_SIZE, LOG_TYPES } from "../constants.js";
import { unwrapList } from "../engine/unwrap.js";
import { getClient, handleApiError } from "../services/api-client.js";
import { truncateForModel } from "../text-utils.js";

export function registerLogTools(server: McpServer): void {
  server.registerTool(
    "fortimail_list_log_files",
    {
      title: "List Log Files",
      description: "**Purpose:** `GET /v1/logs?type=&limit=&offset=`.",
      inputSchema: {
        log_type: z.enum(LOG_TYPES).describe("Log type"),
        start_index: z.number().int().min(0).default(0),
        page_size: z.number().int().min(1).max(200).default(DEFAULT_PAGE_SIZE),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ log_type, start_index, page_size }) => {
      try {
        const client = getClient();
        const data = await client.get<unknown>(
          "/logs",
          {
            type: log_type,
            limit: page_size,
            offset: start_index,
          },
          CACHE_TTL.REPORT,
        );
        const files = unwrapList<{ mkey?: string; size?: number; date?: string }>(data);
        let text = `# Log Files: ${log_type} (${files.length})\n\n`;
        for (const f of files) {
          text += `- **${f.mkey ?? "?"}** — size: ${f.size ?? "?"}, date: ${f.date ?? "?"}\n`;
        }
        if (text.length > CHARACTER_LIMIT) text = text.slice(0, CHARACTER_LIMIT) + "\n…(truncated)";
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail_download_log",
    {
      title: "Download Log File",
      description:
        "**Purpose:** `POST /v1/logs/download`. Response bytes are interpreted as UTF-8 text (use `compressed: false` for plain text in MCP).",
      inputSchema: {
        log_file: z.string().min(1).describe("Log file mkey from list"),
        compressed: z.boolean().default(false),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ log_file, compressed }) => {
      try {
        const client = getClient();
        const buf = await client.postBuffer("/logs/download", {
          mmkey: log_file,
          compressed,
        });
        let text = buf.toString("utf8");
        text = truncateForModel(text);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );
}
