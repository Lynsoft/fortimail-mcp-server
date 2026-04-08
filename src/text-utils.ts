import { CHARACTER_LIMIT } from "./constants.js";

/** Final safety gate for LLM context — engine may summarize upstream. */
export function truncateForModel(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n…(truncated)";
}
