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

// Best-effort authenticated screenshot: drive a real browser via the Browserless
// /function endpoint to fill a login form, then capture the page behind it. Login
// forms vary wildly across sites, so this is inherently fragile — on any failure
// we fall back to the normal (unauthenticated) screenshot.
const LOGIN_FN = `export default async function ({ page, context }) {
  const { url, email, password } = context;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
  const userSels = ['input[type=email]','input[autocomplete=username]','input[name*=email i]','input[name*=user i]','input[id*=email i]','input[id*=user i]','input[type=text]'];
  for (const s of userSels) { const el = await page.$(s); if (el) { await el.type(email, { delay: 15 }); break; } }
  const pass = await page.$('input[type=password]');
  if (pass) await pass.type(password, { delay: 15 });
  const submit = await page.$('button[type=submit], input[type=submit], button[name*=login i], button[id*=login i]');
  if (submit) { await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}), submit.click()]); }
  else { await page.keyboard.press('Enter'); await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}); }
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
  const buf = await page.screenshot({ type: 'png', fullPage: false });
  return { data: buf.toString('base64'), type: 'text/plain' };
}`;

export async function browserlessLoginScreenshot(
  url: string,
  creds: { email: string; password: string },
): Promise<{ image?: LLMImage; text?: string }> {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) return { text: `(no browser configured for ${url})` };
  try {
    const res = await fetch(`${BASE}/function?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: LOGIN_FN, context: { url, email: creds.email, password: creds.password } }),
      signal: AbortSignal.timeout(70000),
    });
    if (!res.ok) return browserlessScreenshot(url);
    let b64 = (await res.text()).trim();
    if (b64.startsWith("{")) {
      try {
        b64 = (JSON.parse(b64).data ?? b64) as string;
      } catch {
        /* not JSON-wrapped */
      }
    }
    b64 = b64.replace(/^"|"$/g, "");
    if (b64.length < 100) return browserlessScreenshot(url);
    return { image: { mimeType: "image/png", dataBase64: b64 }, text: `Logged-in screenshot captured of ${url}.` };
  } catch {
    return browserlessScreenshot(url);
  }
}
