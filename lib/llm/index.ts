import { LLMProvider } from "./types";
import { stubProvider } from "./stub";
import { geminiProvider } from "./gemini";
import { grokProvider } from "./grok";

export type { LLMProvider, LLMRequest } from "./types";

let cached: LLMProvider | null = null;

/**
 * Resolve the active LLM provider from env (default: stub).
 * Falls back to stub if the chosen provider has no key, so dev/demo always works.
 */
export function getProvider(): LLMProvider {
  if (cached) return cached;
  const choice = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();

  try {
    if (choice === "gemini" && process.env.GEMINI_API_KEY) cached = geminiProvider();
    else if (choice === "grok" && process.env.XAI_API_KEY) cached = grokProvider();
    else cached = stubProvider;
  } catch {
    cached = stubProvider;
  }
  return cached;
}
