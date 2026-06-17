import type { LLMImage } from "@/lib/llm/types";

// Real page screenshots via Browserless (https://www.browserless.io). Activated
// when BROWSERLESS_TOKEN is set. The PNG is returned as a base64 vision image so
// the UX / journey specialists can actually *see* the page.
const BASE = process.env.BROWSERLESS_URL || "https://production-sfo.browserless.io";

export async function browserlessScreenshot(
  url: string,
): Promise<{ image?: LLMImage; text?: string }> {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) return { text: `(no browser configured for ${url})` };
  try {
    const res = await fetch(`${BASE}/screenshot?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        options: { type: "png", fullPage: false },
        gotoOptions: { waitUntil: "networkidle2", timeout: 25000 },
        viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 120);
      return { text: `(screenshot failed ${res.status}: ${detail})` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      image: { mimeType: "image/png", dataBase64: buf.toString("base64") },
      text: `Live screenshot captured of ${url} (1280×800).`,
    };
  } catch (e) {
    return { text: `(screenshot error: ${String(e).slice(0, 80)})` };
  }
}
