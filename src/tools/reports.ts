/**
 * Reports — FortiMail Engine `/v1/reports` API.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CACHE_TTL, CHARACTER_LIMIT, DEFAULT_PAGE_SIZE } from "../constants.js";
import { unwrapList } from "../engine/unwrap.js";
import { getClient, handleApiError } from "../services/api-client.js";
import { truncateForModel } from "../text-utils.js";

const reportClassEnum = z
  .enum(["domain_mailstats", "mailbox_stats", "mail_stats"])
  .optional()
  .describe("Report class filter");

export function registerReportTools(server: McpServer): void {
  server.registerTool(
    "fortimail_list_reports",
    {
      title: "List Reports",
      description: "**Purpose:** `GET /v1/reports`.",
      inputSchema: {
        report_class: reportClassEnum,
        domain: z.string().optional().describe("Filter by domain mkey when supported by the engine"),
        start_index: z.number().int().min(0).default(0).describe("Pagination offset"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(DEFAULT_PAGE_SIZE)
          .describe("Page size (max 200)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ report_class, domain, start_index, page_size }) => {
      try {
        const client = getClient();
        const params: Record<string, unknown> = {
          limit: page_size,
          offset: start_index,
        };
        if (report_class) params.reportClass = report_class;
        if (domain) params.domain = domain;

        const data = await client.get<unknown>("/reports", params, CACHE_TTL.REPORT);
        const items = unwrapList<{
          mkey?: string;
          reportClass?: string;
          domain?: string;
          size?: number;
          date?: string;
        }>(data);
        let text = `# Reports (${items.length})\n\n`;
        for (const r of items) {
          text += `- **${r.mkey ?? "?"}** — class: ${r.reportClass ?? "—"}, domain: ${r.domain ?? "—"}, size: ${r.size ?? "—"}, date: ${r.date ?? "—"}\n`;
        }
        if (text.length > CHARACTER_LIMIT) text = text.slice(0, CHARACTER_LIMIT) + "\n…(truncated)";
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail_download_report",
    {
      title: "Download Report",
      description: "**Purpose:** `POST /v1/reports/download` (binary payload decoded as UTF-8 text when possible).",
      inputSchema: {
        report_key: z.string().min(1).describe("Report mkey from list reports"),
        report_class: z
          .enum(["domain_mailstats", "mailbox_stats", "mail_stats"])
          .describe("Report class for download"),
        domain: z.string().optional().describe("Domain mkey when required by report type"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ report_key, report_class, domain }) => {
      try {
        const client = getClient();
        const body: Record<string, unknown> = {
          mmkey: report_key,
          reportClass: report_class,
        };
        if (domain) body.domain = domain;
        const buf = await client.postBuffer("/reports/download", body);
        let text = buf.toString("utf8");
        text = truncateForModel(text);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail_delete_reports",
    {
      title: "Delete Reports",
      description: "**Purpose:** `DELETE /v1/reports` with query params.",
      inputSchema: {
        report_keys: z.string().min(1).describe("Comma-separated report mkeys to delete"),
        report_class: reportClassEnum,
        domain: z.string().optional().describe("Filter deletes by domain when supported"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ report_keys, report_class, domain }) => {
      try {
        const client = getClient();
        const params: Record<string, unknown> = { mmkey: report_keys };
        if (report_class) params.reportClass = report_class;
        if (domain) params.domain = domain;
        await client.delete("/reports", params);
        await client.flushCache();
        return { content: [{ type: "text", text: `Deleted report(s): ${report_keys}` }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail_generate_mail_stats_report",
    {
      title: "Generate Mail Statistics Report",
      description: "**Purpose:** `POST /v1/reports/mail-stats`.",
      inputSchema: {
        task_name: z.string().min(1).describe("Task mmkey e.g. Daily_Stats"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ task_name }) => {
      try {
        const client = getClient();
        const res = await client.post("/reports/mail-stats", { mmkey: task_name });
        return {
          content: [
            {
              type: "text",
              text: `Mail statistics report triggered.\n${JSON.stringify(res, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail_generate_domain_mail_stats_report",
    {
      title: "Generate Domain Mail Statistics Report",
      description: "**Purpose:** `POST /v1/reports/domain-stats`.",
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const client = getClient();
        const res = await client.post("/reports/domain-stats", {});
        return {
          content: [
            {
              type: "text",
              text: `Domain mail statistics report triggered.\n${JSON.stringify(res, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail_generate_mailbox_stats_report",
    {
      title: "Generate Mailbox Statistics Report",
      description: "**Purpose:** `POST /v1/reports/mailbox`.",
      inputSchema: {
        task_name: z
          .string()
          .min(1)
          .describe("Scheduled task mmkey for mailbox statistics (e.g. from engine UI)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ task_name }) => {
      try {
        const client = getClient();
        const res = await client.post("/reports/mailbox", { mmkey: task_name });
        return {
          content: [
            {
              type: "text",
              text: `Mailbox statistics report triggered.\n${JSON.stringify(res, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );
}
