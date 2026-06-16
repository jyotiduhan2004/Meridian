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

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    },
  };
}
