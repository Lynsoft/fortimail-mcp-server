/**
 * Every HTTP path + method the MCP server uses against the FortiMail Engine.
 * Kept in sync with `src/tools/*` and `EngineClient` health helpers in `api-client.ts`.
 * Validated by `openapi-routes.test.ts` against `openapi/openapi.json`.
 */

export type EngineHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface EngineHttpRoute {
  method: EngineHttpMethod;
  /** Path template exactly as in OpenAPI `paths` (e.g. `/domains/{key}`). */
  path: string;
}

/**
 * Routes invoked by this MCP (excluding intentional no-op tools and API-key admin endpoints).
 */
export const ENGINE_HTTP_ROUTES: readonly EngineHttpRoute[] = [
  // api-client.ts — liveness/readiness
  { method: "GET", path: "/health" },
  { method: "GET", path: "/health/detailed" },

  // domains.ts
  { method: "GET", path: "/domains" },
  { method: "GET", path: "/domains/{key}" },
  { method: "POST", path: "/domains/{key}" },
  { method: "PUT", path: "/domains/{key}" },
  { method: "DELETE", path: "/domains/{key}" },
  { method: "GET", path: "/domain-info/{key}" },
  { method: "PUT", path: "/domain-info/{key}" },

  // users.ts
  { method: "GET", path: "/domains/{domain}/users" },
  { method: "GET", path: "/domains/{domain}/users/{key}" },
  { method: "POST", path: "/domains/{domain}/users/{key}" },
  { method: "PUT", path: "/domains/{domain}/users/{key}" },
  { method: "DELETE", path: "/domains/{domain}/users/{key}" },
  { method: "GET", path: "/user-maps" },
  { method: "POST", path: "/user-maps/{key}" },
  { method: "PUT", path: "/user-maps/{key}" },
  { method: "DELETE", path: "/user-maps/{key}" },

  // profiles.ts
  { method: "GET", path: "/geo-profiles" },
  { method: "GET", path: "/geo-profiles/{key}" },
  { method: "POST", path: "/geo-profiles/{key}" },
  { method: "PUT", path: "/geo-profiles/{key}" },
  { method: "DELETE", path: "/geo-profiles/{key}" },
  { method: "GET", path: "/domains/{domain}/notifications" },
  { method: "GET", path: "/domains/{domain}/notifications/{key}" },
  { method: "POST", path: "/domains/{domain}/notifications/{key}" },
  { method: "PUT", path: "/domains/{domain}/notifications/{key}" },
  { method: "DELETE", path: "/domains/{domain}/notifications/{key}" },
  { method: "GET", path: "/domains/{domain}/auth/imap" },
  { method: "GET", path: "/domains/{domain}/auth/imap/{key}" },
  { method: "POST", path: "/domains/{domain}/auth/imap/{key}" },
  { method: "PUT", path: "/domains/{domain}/auth/imap/{key}" },
  { method: "DELETE", path: "/domains/{domain}/auth/imap/{key}" },
  { method: "GET", path: "/domains/{domain}/auth/smtp" },
  { method: "GET", path: "/domains/{domain}/auth/smtp/{key}" },
  { method: "POST", path: "/domains/{domain}/auth/smtp/{key}" },
  { method: "PUT", path: "/domains/{domain}/auth/smtp/{key}" },
  { method: "DELETE", path: "/domains/{domain}/auth/smtp/{key}" },

  // mail-queue.ts
  { method: "GET", path: "/queue" },
  { method: "GET", path: "/queue/view" },
  { method: "DELETE", path: "/queue" },
  { method: "POST", path: "/queue/reroute" },

  // smtp.ts
  { method: "GET", path: "/smtp-config" },
  { method: "PUT", path: "/smtp-config" },

  // logs.ts
  { method: "GET", path: "/logs" },
  { method: "POST", path: "/logs/download" },

  // reports.ts
  { method: "GET", path: "/reports" },
  { method: "DELETE", path: "/reports" },
  { method: "POST", path: "/reports/download" },
  { method: "POST", path: "/reports/mail-stats" },
  { method: "POST", path: "/reports/domain-stats" },
  { method: "POST", path: "/reports/mailbox" },
];
