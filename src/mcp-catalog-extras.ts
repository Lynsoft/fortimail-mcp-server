/**
 * Optional MCP prompts/resources so clients that list them (e.g. Smithery) get
 * JSON-RPC success instead of -32601 Method not found.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const ABOUT_URI = "fortimail-mcp://about";

export function registerMcpCatalogExtras(server: McpServer): void {
  server.registerPrompt(
    "fortimail_incident_triage",
    {
      title: "FortiMail incident triage",
      description:
        "Structured starter prompt for mail or security incidents when operating FortiMail via this MCP.",
      argsSchema: {
        domain: z.string().min(1).describe("Affected mail domain or protected domain name"),
      },
    },
    async ({ domain }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `You are assisting with FortiMail operations for domain **${domain}**.\n\n` +
              `1. Summarize the reported symptom (delivery, spam, auth, queue).\n` +
              `2. List which FortiMail MCP tools to call next (engine status, domains, queue, logs, reports) and why.\n` +
              `3. Call out any destructive actions and confirm before execution.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "fortimail_queue_investigation",
    {
      title: "Mail queue investigation",
      description:
        "Step-by-step prompt for diagnosing stuck or deferred messages in the FortiMail mail queue.",
      argsSchema: {
        sender: z.string().optional().describe("Envelope sender to filter on (optional)"),
        recipient: z.string().optional().describe("Envelope recipient to filter on (optional)"),
      },
    },
    async ({ sender, recipient }) => {
      const filters: string[] = [];
      if (sender) filters.push(`sender = ${sender}`);
      if (recipient) filters.push(`recipient = ${recipient}`);
      const filterLine =
        filters.length > 0
          ? `Apply these filters: ${filters.join(", ")}.`
          : "No filters specified — start with the full queue.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Investigate the FortiMail mail queue for delivery issues.\n\n` +
                `${filterLine}\n\n` +
                `1. Call **fortimail.queue.list** to get an overview of queued messages.\n` +
                `2. If messages are stuck, call **fortimail.queue.search** with relevant filters.\n` +
                `3. For each suspicious message, call **fortimail.queue.view** to inspect headers.\n` +
                `4. Summarize root cause (DNS, TLS, recipient reject, rate limit) and recommend next steps.\n` +
                `5. Only suggest destructive actions (delete, reroute) after user confirmation.`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "fortimail_domain_audit",
    {
      title: "Domain security audit",
      description:
        "Audit a protected domain's configuration, user list, and profile assignments on FortiMail.",
      argsSchema: {
        domain: z.string().min(1).describe("Domain name to audit"),
      },
    },
    async ({ domain }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Perform a security audit for domain **${domain}** on FortiMail.\n\n` +
              `1. Call **fortimail.domains.get** to check domain settings (IP, status, TLS).\n` +
              `2. Call **fortimail.domains.info.get** for account metadata and limits.\n` +
              `3. Call **fortimail.users.list** to enumerate mailbox users.\n` +
              `4. List the notification, IMAP auth, and SMTP auth profiles for this domain.\n` +
              `5. Highlight misconfigurations, missing profiles, or excessive account limits.\n` +
              `6. Provide a prioritized remediation list.`,
          },
        },
      ],
    }),
  );

  server.registerResource(
    "fortimail_mcp_about",
    ABOUT_URI,
    {
      title: "FortiMail MCP connector",
      description:
        "Short overview of this MCP: FortiMail Engine API client over Streamable HTTP; tools map to OpenAPI `/v1` routes.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: ABOUT_URI,
          text:
            "# FortiMail MCP\n\n" +
            "This server exposes FortiMail **Engine** REST endpoints (`/v1`) as MCP tools. " +
            "Configure `FORTIMAIL_ENGINE_URL` and `FORTIMAIL_ENGINE_API_KEY` on the host. " +
            "Use `fortimail.engine.status` to verify connectivity.",
        },
      ],
    }),
  );
}
