/**
 * FortiMail Engine list endpoints return `{ data, meta }`; legacy FortiMail used `collection`.
 */
export function unwrapList<T>(body: unknown): T[] {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.collection)) return o.collection as T[];
  }
  return [];
}

export function unwrapMeta(body: unknown): Record<string, unknown> | undefined {
  if (body && typeof body === "object" && "meta" in body) {
    const m = (body as { meta?: unknown }).meta;
    if (m && typeof m === "object") return m as Record<string, unknown>;
  }
  return undefined;
}
