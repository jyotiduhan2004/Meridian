import { LLMProvider, LLMRequest } from "./types";

// Google Gemini via REST (no SDK). Supports vision via inline_data.
// Activated when LLM_PROVIDER=gemini and GEMINI_API_KEY is set.
export function geminiProvider(): LLMProvider {
  const key = process.env.GEMINI_API_KEY ?? "";
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  return {
    name: "gemini",
    vision: true,
    async complete(req: LLMRequest): Promise<string> {
      if (!key) throw new Error("GEMINI_API_KEY is not set");

      const parts: Record<string, unknown>[] = [{ text: req.prompt }];
      for (const img of req.images ?? []) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.dataBase64 } });
      }

      const body: Record<string, unknown> = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.4,
          // Disable extended "thinking": structured scoring doesn't need it, and
          // it cuts ~2k tokens + several seconds per call (and the free-tier 429s).
          thinkingConfig: { thinkingBudget: 0 },
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
        ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      let lastErr = "";
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        }
        const errText = await res.text();
        lastErr = `Gemini ${res.status}: ${errText.slice(0, 200)}`;
        // Back off and retry on transient rate-limit / overload. Honor the
        // server-suggested retryDelay when present, capped so a skill can't hang.
        if (res.status === 429 || res.status === 503) {
          const suggested = errText.match(/"retryDelay":\s*"(\d+)s"/);
          const wait = suggested
            ? Math.min(Number(suggested[1]) * 1000 + 500, 18000)
            : Math.min(1500 * 2 ** attempt, 12000);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(lastErr);
      }
      throw new Error(lastErr);
    },
  };
}
