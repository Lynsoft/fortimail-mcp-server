/**
 * Wraps MCP tool handlers once at registration time for logging.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolHandler } from "./logging.js";

export function instrumentMcpToolRegistration(server: McpServer): void {
  const original = server.registerTool.bind(server);
  (server as unknown as { registerTool: typeof original }).registerTool = (name, config, cb) => {
    const wrapped = async (args: unknown, extra: unknown) =>
      wrapToolHandler(name, async () =>
        (cb as (a: unknown, e: unknown) => Promise<unknown>)(args, extra),
      );
    return original(name, config, wrapped as Parameters<typeof original>[2]);
  };
}
