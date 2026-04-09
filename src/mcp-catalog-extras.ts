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
            "Use `fortimail_engine_status` to verify connectivity.",
        },
      ],
    }),
  );
}
