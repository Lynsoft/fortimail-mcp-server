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

/** Trim and strip a single pair of surrounding quotes (common in Docker / .env mistakes). */
function normalizeEnvSecret(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  let s = raw.trim();
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'") && s[s.length - 1] === q) {
      s = s.slice(1, -1).trim();
    }
  }
  return s;
}

function headerString(
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined {
  const v = headers[name.toLowerCase()];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

/** Value after `Bearer` (case-insensitive), trimmed — matches gateways that add extra spaces. */
export function bearerCredentialFromAuthorization(
  authorization: string | undefined,
): string | undefined {
  if (typeof authorization !== "string") return undefined;
  const m = /^Bearer\s+([\s\S]+)$/i.exec(authorization.trim());
  if (!m) return undefined;
  return m[1].trim();
}

/**
 * Returns true if the request is allowed to access /mcp.
 * If neither env var is set, allows all requests (document unsafe for remote use).
 *
 * Bearer auth:
 * - `Authorization: Bearer <token>`
 * - `X-MCP-Bearer-Token: <token>` (Smithery session config `x-from` / gateway passthrough)
 * - query `?mcp_bearer_token=<token>` (less ideal — can appear in access logs)
 */
export function isMcpHttpAuthorized(
  headers: IncomingHttpHeaders,
  query?: QueryLike,
): boolean {
  const bearer = normalizeEnvSecret(process.env.MCP_HTTP_BEARER_TOKEN);
  const apiKey = normalizeEnvSecret(process.env.MCP_HTTP_API_KEY);
  if (!bearer && !apiKey) return true;

  if (bearer) {
    const fromAuth = bearerCredentialFromAuthorization(
      typeof headers.authorization === "string"
        ? headers.authorization
        : Array.isArray(headers.authorization)
          ? headers.authorization[0]
          : undefined,
    );
    if (fromAuth === bearer) return true;

    const xMcp = headerString(headers, "x-mcp-bearer-token")?.trim();
    if (xMcp === bearer) return true;

    const q1 = firstQueryString(query, "mcp_bearer_token")?.trim();
    if (q1 === bearer) return true;
    const q2 = firstQueryString(query, "mcp-bearer-token")?.trim();
    if (q2 === bearer) return true;
  }
  if (apiKey) {
    const key = headers["x-api-key"];
    const v = Array.isArray(key) ? key[0] : key;
    if (typeof v === "string" && v.trim() === apiKey) return true;
  }
  return false;
}
