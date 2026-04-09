/**
 * Mail queue — FortiMail Engine `/v1/queue` API.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  CACHE_TTL,
  CHARACTER_LIMIT,
  DEFAULT_PAGE_SIZE,
  QUEUE_TYPES,
  ACCOUNT_TYPES,
} from "../constants.js";
import { unwrapList, unwrapMeta } from "../engine/unwrap.js";
import { getClient, handleApiError } from "../services/api-client.js";
import type { MailQueueItem, QueueMailView } from "../types.js";

const queueTypeEnum = z
  .enum([
    "default",
    "incoming",
    "outgoing",
    "sdefault",
    "sincoming",
    "soutgoing",
    "ibe",
    "sibe",
    "fortiguard",
    "sandbox",
    "outbreak",
    "tqueue",
    "ecqueue",
  ])
  .describe("Queue type key (maps to engine `type` integer)");

function formatQueueItem(item: MailQueueItem | Record<string, unknown>): string {
  const i = item as Record<string, unknown>;
  const from = (i.envfrom as string) || "—";
  const to = (i.envto as string) || "—";
  const subj = (i.subject as string) || "(no subject)";
  return (
    `  - **${i.mkey}**\n` +
    `    From: ${from} → To: ${to}\n` +
    `    Subject: ${subj}\n` +
    `    Reason: ${String(i.reason ?? "—")}\n` +
    `    Tries: ${String(i.tries ?? "—")}, Client IP: ${String(i.cli_ip ?? "—")}\n`
  );
}

export function registerMailQueueTools(server: McpServer): void {
  server.registerTool(
    "fortimail.queue.list",
    {
      title: "List Mail Queue",
      description:
        "**Purpose:** `GET /v1/queue` with `type`, `offset`, `limit`.\n" +
        "**Side effects:** None (read-only).",
      inputSchema: {
        queue_type: queueTypeEnum,
        start_index: z.number().int().min(0).default(0).describe("Pagination offset"),
        page_size: z.number().int().min(1).max(200).default(DEFAULT_PAGE_SIZE).describe("Page size"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ queue_type, start_index, page_size }) => {
      try {
        const client = getClient();
        const data = await client.get<unknown>(
          "/queue",
          {
            type: QUEUE_TYPES[queue_type],
            offset: start_index,
            limit: page_size,
          },
          CACHE_TTL.MAIL_QUEUE,
        );
        const items = unwrapList<MailQueueItem>(data);
        const meta = unwrapMeta(data);
        let text = `# Mail Queue: ${queue_type} (${items.length} shown)\n\n`;
        for (const item of items) text += formatQueueItem(item) + "\n";
        if (meta?.hasMore === true) text += `\n_More results available — increase offset._`;
        if (text.length > CHARACTER_LIMIT) text = text.slice(0, CHARACTER_LIMIT) + "\n…(truncated)";
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.queue.search",
    {
      title: "Search Mail Queue",
      description:
        "**Purpose:** `GET /v1/queue` with optional `sender`, `recipient`, `clientIp`, `sessionId`, `reason`, `type`.\n" +
        "**Side effects:** None (read-only).",
      inputSchema: {
        queue_type: queueTypeEnum,
        relation: z.enum(["and", "or"]).default("and").describe("Ignored by engine; filters are combined per engine rules"),
        client_ip: z.string().optional().describe("Filter by client IP"),
        sender: z.string().optional().describe("Filter by envelope sender"),
        recipient: z.string().optional().describe("Filter by envelope recipient"),
        session_id: z.string().optional().describe("Filter by SMTP/session id when exposed by engine"),
        reason: z.string().optional().describe("Filter by queue reason text"),
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
    async ({
      queue_type,
      client_ip,
      sender,
      recipient,
      session_id,
      reason,
      start_index,
      page_size,
    }) => {
      try {
        const client = getClient();
        const params: Record<string, unknown> = {
          type: QUEUE_TYPES[queue_type],
          offset: start_index,
          limit: page_size,
        };
        if (sender) params.sender = sender;
        if (recipient) params.recipient = recipient;
        if (client_ip) params.clientIp = client_ip;
        if (session_id) params.sessionId = session_id;
        if (reason) params.reason = reason;

        const data = await client.get<unknown>("/queue", params, CACHE_TTL.MAIL_QUEUE);
        const items = unwrapList<MailQueueItem>(data);
        let text = `# Queue Search: ${queue_type} (${items.length})\n\n`;
        for (const item of items) text += formatQueueItem(item) + "\n";
        if (text.length > CHARACTER_LIMIT) text = text.slice(0, CHARACTER_LIMIT) + "\n…(truncated)";
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.queue.view",
    {
      title: "View Queued Mail",
      description: "**Purpose:** `GET /v1/queue/view`.",
      inputSchema: {
        mail_key: z.string().min(1).describe("Message mkey from queue list"),
        account_type: z
          .enum([
            "dead_mail",
            "deferred_queue",
            "incoming_queue",
            "outgoing_queue",
            "slow_deferred",
            "slow_incoming",
            "slow_outgoing",
            "ibe_queue",
            "ibe_slow",
            "fortiguard",
            "sandbox",
            "outbreak",
            "ec_queue",
          ])
          .describe("Queue/account bucket for the message"),
        open_method: z
          .number()
          .int()
          .min(2)
          .max(3)
          .default(3)
          .describe("Engine open_method (2 or 3 per API)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ mail_key, account_type, open_method }) => {
      try {
        const client = getClient();
        const data = await client.get<QueueMailView & Record<string, unknown>>("/queue/view", {
          mkey: mail_key,
          account_type: ACCOUNT_TYPES[account_type],
          open_method,
        });
        let text =
          `# Queued Mail: ${data.subject ?? "?"}\n\n` +
          `- **From**: ${data.from ?? "—"}\n` +
          `- **To**: ${data.to ?? "—"}\n` +
          `- **Date**: ${data.date ?? "—"}\n` +
          `- **CC**: ${data.cc || "—"}\n` +
          `- **Message-ID**: ${data.message_id ?? "—"}\n` +
          `- **Size**: ${data.size ?? "—"} bytes\n\n` +
          `## Body\n\n`;
        for (const r of data.readables ?? []) {
          text += r.content + "\n";
        }
        if (text.length > CHARACTER_LIMIT) text = text.slice(0, CHARACTER_LIMIT) + "\n…(truncated)";
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.queue.delete",
    {
      title: "Delete Queued Mail",
      description:
        "**Purpose:** `DELETE /v1/queue` with confirmation header (see engine docs).\n" +
        "**Side effects:** Destructive.",
      inputSchema: {
        mail_keys: z.string().min(1).describe("Comma-separated mkeys"),
        queue_type: queueTypeEnum,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ mail_keys, queue_type }) => {
      try {
        const client = getClient();
        await client.delete(
          "/queue",
          undefined,
          {
            confirm: true,
            mmkey: mail_keys,
            extraParam: QUEUE_TYPES[queue_type],
          },
          { "x-confirm-destructive": "true" },
        );
        await client.flushCache();
        return { content: [{ type: "text", text: `Deleted queued mail(s): ${mail_keys}` }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.queue.reroute",
    {
      title: "Send Queued Mail to Alternate Host",
      description: "**Purpose:** `POST /v1/queue/reroute`.",
      inputSchema: {
        mail_keys: z.string().min(1).describe("Comma-separated message mkeys to reroute"),
        queue_type: queueTypeEnum,
        alternate_host: z
          .string()
          .min(1)
          .describe("Target host to receive rerouted mail"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ mail_keys, queue_type, alternate_host }) => {
      try {
        const client = getClient();
        const res = await client.post("/queue/reroute", {
          mmkey: mail_keys,
          host: alternate_host,
          queueType: QUEUE_TYPES[queue_type],
        });
        await client.flushCache();
        return {
          content: [
            {
              type: "text",
              text: `Reroute requested: ${alternate_host}\n${JSON.stringify(res, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
      }
    },
  );

  server.registerTool(
    "fortimail.queue.download",
    {
      title: "Download Queued Mail",
      description:
        "**Purpose:** Not exposed on the FortiMail Engine OpenAPI in this MCP version.\n" +
        "**Returns:** Error guidance.",
      inputSchema: {
        mail_keys: z.string().min(1).describe("Comma-separated message mkeys (not implemented in this stub)"),
        queue_type: queueTypeEnum,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => ({
      isError: true,
      content: [
        {
          type: "text",
          text:
            "Error: Raw queued-mail download is not available through this MCP build. " +
            "Use `fortimail_view_queued_mail` or extend the FortiMail Engine API and regenerate `openapi/openapi.json`.",
        },
      ],
    }),
  );
}
