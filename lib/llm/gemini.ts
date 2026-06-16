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
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
        ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      let lastErr = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        }
        lastErr = `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`;
        // Back off and retry on transient rate-limit / overload.
        if (res.status === 429 || res.status === 503) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(lastErr);
      }
      throw new Error(lastErr);
    },
  };
}
