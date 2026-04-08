/**
 * Structured stderr logging for tool invocations. No secrets or mail bodies.
 */

export type ToolOutcome = "ok" | "tool_error" | "thrown";

export function logToolStart(tool: string): void {
  console.error(
    JSON.stringify({
      event: "tool_invoke",
      phase: "start",
      tool,
      ts: Date.now(),
    }),
  );
}

export function logToolEnd(tool: string, startMs: number, outcome: ToolOutcome): void {
  console.error(
    JSON.stringify({
      event: "tool_invoke",
      phase: "end",
      tool,
      ms: Date.now() - startMs,
      outcome,
    }),
  );
}

function parseOutcome(result: unknown): ToolOutcome {
  if (
    result &&
    typeof result === "object" &&
    "isError" in result &&
    (result as { isError?: boolean }).isError === true
  ) {
    return "tool_error";
  }
  return "ok";
}

/**
 * Wraps a tool handler to log duration and outcome (no secrets).
 */
export async function wrapToolHandler<T>(tool: string, fn: () => Promise<T>): Promise<T> {
  const startMs = Date.now();
  logToolStart(tool);
  try {
    const value = await fn();
    logToolEnd(tool, startMs, parseOutcome(value));
    return value;
  } catch (e) {
    logToolEnd(tool, startMs, "thrown");
    throw e;
  }
}
