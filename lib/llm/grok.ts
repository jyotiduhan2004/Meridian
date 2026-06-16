import { LLMProvider, LLMRequest } from "./types";

// xAI Grok via the OpenAI-compatible REST endpoint.
// Activated when LLM_PROVIDER=grok and XAI_API_KEY is set.
export function grokProvider(): LLMProvider {
  const key = process.env.XAI_API_KEY ?? "";
  const model = process.env.XAI_MODEL ?? "grok-2-latest";

  return {
    name: "grok",
    vision: true, // use a vision model (e.g. grok-2-vision) for image requests
    async complete(req: LLMRequest): Promise<string> {
      if (!key) throw new Error("XAI_API_KEY is not set");

      const userContent: unknown = req.images?.length
        ? [
            { type: "text", text: req.prompt },
            ...req.images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mimeType};base64,${img.dataBase64}` },
            })),
          ]
        : req.prompt;

      const messages = [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: userContent },
      ];

      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Grok ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? "";
    },
  };
}
