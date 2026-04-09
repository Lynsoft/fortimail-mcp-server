/**
 * Optional authentication for HTTP transport. Keeps checks testable without Express.
 */

import type { IncomingHttpHeaders } from "node:http";

/** Express/qs query values for optional `?mcp_bearer_token=` (e.g. Smithery gateway). */
type QueryLike = Record<string, unknown> | undefined;

function firstQueryString(query: QueryLike, name: string): string | undefined {
  const v = query?.[name];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

/**
 * Returns true if the request is allowed to access /mcp.
 * If neither env var is set, allows all requests (document unsafe for remote use).
 *
 * Bearer auth: `Authorization: Bearer <token>` or query `?mcp_bearer_token=<token>`
 * (query is less ideal — can appear in access logs; prefer headers when the client supports it).
 */
export function isMcpHttpAuthorized(
  headers: IncomingHttpHeaders,
  query?: QueryLike,
): boolean {
  const bearer = process.env.MCP_HTTP_BEARER_TOKEN?.trim();
  const apiKey = process.env.MCP_HTTP_API_KEY?.trim();
  if (!bearer && !apiKey) return true;

  if (bearer) {
    const auth = headers.authorization;
    if (auth === `Bearer ${bearer}`) return true;
    if (firstQueryString(query, "mcp_bearer_token") === bearer) return true;
  }
  if (apiKey) {
    const key = headers["x-api-key"];
    const v = Array.isArray(key) ? key[0] : key;
    if (v === apiKey) return true;
  }
  return false;
}
