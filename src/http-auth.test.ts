import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  bearerCredentialFromAuthorization,
  isMcpHttpAuthorized,
} from "./http-auth.js";

describe("isMcpHttpAuthorized", () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    snapshot.b = process.env.MCP_HTTP_BEARER_TOKEN;
    snapshot.k = process.env.MCP_HTTP_API_KEY;
  });

  afterEach(() => {
    if (snapshot.b === undefined) delete process.env.MCP_HTTP_BEARER_TOKEN;
    else process.env.MCP_HTTP_BEARER_TOKEN = snapshot.b;
    if (snapshot.k === undefined) delete process.env.MCP_HTTP_API_KEY;
    else process.env.MCP_HTTP_API_KEY = snapshot.k;
  });

  it("allows all requests when no auth env is set", () => {
    delete process.env.MCP_HTTP_BEARER_TOKEN;
    delete process.env.MCP_HTTP_API_KEY;
    expect(isMcpHttpAuthorized({})).toBe(true);
  });

  it("accepts valid Bearer token", () => {
    process.env.MCP_HTTP_BEARER_TOKEN = "secret";
    delete process.env.MCP_HTTP_API_KEY;
    expect(
      isMcpHttpAuthorized({ authorization: "Bearer secret" }),
    ).toBe(true);
    expect(isMcpHttpAuthorized({})).toBe(false);
  });

  it("accepts Bearer with extra spaces or lowercase scheme (gateways)", () => {
    process.env.MCP_HTTP_BEARER_TOKEN = "secret";
    delete process.env.MCP_HTTP_API_KEY;
    expect(isMcpHttpAuthorized({ authorization: "Bearer  secret" })).toBe(true);
    expect(isMcpHttpAuthorized({ authorization: "bearer secret" })).toBe(true);
    expect(bearerCredentialFromAuthorization("Bearer secret")).toBe("secret");
  });

  it("strips surrounding quotes from env token (Docker .env mistakes)", () => {
    process.env.MCP_HTTP_BEARER_TOKEN = '"secret"';
    delete process.env.MCP_HTTP_API_KEY;
    expect(isMcpHttpAuthorized({ authorization: "Bearer secret" })).toBe(true);
  });

  it("accepts mcp_bearer_token query param when Bearer env is set (gateway / Smithery)", () => {
    process.env.MCP_HTTP_BEARER_TOKEN = "secret";
    delete process.env.MCP_HTTP_API_KEY;
    expect(isMcpHttpAuthorized({}, { mcp_bearer_token: "secret" })).toBe(true);
    expect(isMcpHttpAuthorized({}, { mcp_bearer_token: "wrong" })).toBe(false);
  });

  it("accepts X-MCP-Bearer-Token header (Smithery session config x-from)", () => {
    process.env.MCP_HTTP_BEARER_TOKEN = "secret";
    delete process.env.MCP_HTTP_API_KEY;
    expect(isMcpHttpAuthorized({ "x-mcp-bearer-token": "secret" })).toBe(true);
    expect(isMcpHttpAuthorized({ "x-mcp-bearer-token": "wrong" })).toBe(false);
  });

  it("accepts valid X-API-Key when configured", () => {
    delete process.env.MCP_HTTP_BEARER_TOKEN;
    process.env.MCP_HTTP_API_KEY = "key1";
    expect(isMcpHttpAuthorized({ "x-api-key": "key1" })).toBe(true);
    expect(isMcpHttpAuthorized({})).toBe(false);
  });

  it("accepts either Bearer or API key when both are set", () => {
    process.env.MCP_HTTP_BEARER_TOKEN = "b";
    process.env.MCP_HTTP_API_KEY = "k";
    expect(isMcpHttpAuthorized({ authorization: "Bearer b" })).toBe(true);
    expect(isMcpHttpAuthorized({ "x-api-key": "k" })).toBe(true);
    expect(isMcpHttpAuthorized({})).toBe(false);
  });
});
