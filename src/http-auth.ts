/**
 * Optional authentication for HTTP transport. Keeps checks testable without Express.
 */

import type { IncomingHttpHeaders } from "node:http";

/**
 * Returns true if the request is allowed to access /mcp.
 * If neither env var is set, allows all requests (document unsafe for remote use).
 */
export function isMcpHttpAuthorized(headers: IncomingHttpHeaders): boolean {
  const bearer = process.env.MCP_HTTP_BEARER_TOKEN?.trim();
  const apiKey = process.env.MCP_HTTP_API_KEY?.trim();
  if (!bearer && !apiKey) return true;

  if (bearer) {
    const auth = headers.authorization;
    if (auth === `Bearer ${bearer}`) return true;
  }
  if (apiKey) {
    const key = headers["x-api-key"];
    const v = Array.isArray(key) ? key[0] : key;
    if (v === apiKey) return true;
  }
  return false;
}
