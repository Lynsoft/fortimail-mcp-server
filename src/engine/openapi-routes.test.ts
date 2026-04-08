import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { ENGINE_HTTP_ROUTES, type EngineHttpMethod } from "./openapi-routes.js";

interface OpenApiDoc {
  paths: Record<string, Record<string, unknown>>;
}

function loadOpenApi(): OpenApiDoc {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const specPath = join(root, "openapi/openapi.json");
  return JSON.parse(readFileSync(specPath, "utf8")) as OpenApiDoc;
}

function hasOperation(doc: OpenApiDoc, path: string, method: EngineHttpMethod): boolean {
  const item = doc.paths[path];
  if (!item) return false;
  const op = item[method.toLowerCase()];
  return typeof op === "object" && op !== null;
}

describe("ENGINE_HTTP_ROUTES vs openapi/openapi.json", () => {
  const doc = loadOpenApi();

  it("every registered MCP engine route exists in the OpenAPI spec", () => {
    const missing: string[] = [];
    for (const { method, path } of ENGINE_HTTP_ROUTES) {
      if (!hasOperation(doc, path, method)) {
        missing.push(`${method} ${path}`);
      }
    }
    expect(missing, `Missing in OpenAPI: ${missing.join("; ")}`).toEqual([]);
  });

  it("registry has no duplicate method+path pairs", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const { method, path } of ENGINE_HTTP_ROUTES) {
      const k = `${method} ${path}`;
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    expect(dupes, `Duplicates: ${dupes.join("; ")}`).toEqual([]);
  });
});
