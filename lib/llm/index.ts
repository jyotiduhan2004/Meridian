import { LLMProvider } from "./types";
import { stubProvider } from "./stub";
import { geminiProvider } from "./gemini";
import { grokProvider } from "./grok";

export type { LLMProvider, LLMRequest } from "./types";

let cached: LLMProvider | null = null;

function build(choice: string): LLMProvider {
  if (choice === "gemini" && process.env.GEMINI_API_KEY) return geminiProvider();
  if (choice === "grok" && process.env.XAI_API_KEY) return grokProvider();
  return stubProvider;
}

// Transient/rate-limit signatures worth retrying on the other provider.
const TRANSIENT = /429|quota|rate|503|overloaded|500|502|504|timeout|ECONN|network|fetch failed/i;

function withFallback(primary: LLMProvider, secondary: LLMProvider): LLMProvider {
  return {
    name: `${primary.name}->${secondary.name}`,
    vision: primary.vision || secondary.vision,
    async complete(req) {
      try {
        return await primary.complete(req);
      } catch (e) {
        if (TRANSIENT.test(String(e))) return secondary.complete(req);
        throw e;
      }
    },
  };
}

/**
 * Resolve the active LLM provider from env (default: stub).
 * When Gemini is primary and a Grok key is present, Grok auto-catches Gemini's
 * 429s/transient errors (and vice-versa) so a run completes despite rate-limits.
 */
export function getProvider(): LLMProvider {
  if (cached) return cached;
  const choice = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();
  try {
    const primary = build(choice);
    let secondary: LLMProvider | null = null;
    if (primary.name === "gemini" && process.env.XAI_API_KEY) secondary = grokProvider();
    else if (primary.name === "grok" && process.env.GEMINI_API_KEY) secondary = geminiProvider();
    cached = secondary ? withFallback(primary, secondary) : primary;
  } catch {
    cached = stubProvider;
  }
  return cached;
}
