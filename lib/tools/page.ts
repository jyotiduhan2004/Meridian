import type { PageFetch } from "./index";

// Real page fetcher: GET the URL, strip tags to readable text. No key needed.
// Used by the url-based skills (UX copy, discoverability, launch readiness, etc.)
// for text grounding; live screenshots come later via Browserless.

// Look like a real browser so alive-but-picky sites don't 403/refuse us.
export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchOnce(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

// One retry on a thrown fetch (transient network/timeout) before giving up — so a
// reachable site doesn't get falsely marked "no response".
async function fetchWithRetry(url: string, timeoutMs = 14000): Promise<Response> {
  try {
    return await fetchOnce(url, timeoutMs);
  } catch {
    return await fetchOnce(url, timeoutMs);
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function metaDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

// Pull head signals from the RAW html (before scripts are stripped) so the URL
// skills can actually tell whether OG/Twitter cards, analytics, and a favicon
// exist — instead of falsely reporting them missing.
function headSignals(html: string): string {
  const head = (html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html.slice(0, 12000));
  const metas: string[] = [];
  for (const m of head.matchAll(/<meta[^>]+(?:property|name)=["'](og:[^"']+|twitter:[^"']+)["'][^>]*content=["']([^"']*)["']/gi)) {
    metas.push(`${m[1]}="${m[2].slice(0, 80)}"`);
  }
  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(head);
  const hosts = new Set<string>();
  for (const m of head.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    try {
      const host = new URL(m[1], "https://first-party.local").hostname.replace(/^www\./, "");
      if (host !== "first-party.local") hosts.add(host); // skip relative/first-party scripts
    } catch {
      /* ignore */
    }
  }
  const favicon = /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(head);
  const lines = [
    metas.length ? `OG/Twitter meta tags present: ${metas.slice(0, 12).join("; ")}` : "OG/Twitter meta tags: none found",
    `Structured data (JSON-LD): ${hasJsonLd ? "present" : "none found"}`,
    hosts.size ? `External script hosts (analytics/SDKs detectable here): ${[...hosts].slice(0, 20).join(", ")}` : "External script hosts: none found",
    `Favicon link: ${favicon ? "present" : "none found"}`,
  ];
  return `## Page head signals\n${lines.join("\n")}`;
}

// Full raw HTML (untruncated) for link extraction — used by intake enrichment to
// pull the real repo + deployed URL out of an aggregator page (e.g. a Devpost
// submission). Scripts/styles/comments are stripped so analytics noise (stray
// github/CDN links inside <script>) doesn't pollute extraction.
export async function fetchRawHtml(url: string): Promise<string> {
  try {
    const res = await fetchWithRetry(url);
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
  } catch {
    return "";
  }
}

export async function fetchRealPage(url: string): Promise<PageFetch> {
  try {
    const res = await fetchWithRetry(url);
    const html = await res.text();
    const title = titleOf(html);
    const desc = metaDescription(html);
    const body = htmlToText(html).slice(0, 8000);
    const text = [
      title ? `Page title: ${title}` : null,
      desc ? `Meta description: ${desc}` : null,
      "",
      headSignals(html),
      "",
      body,
    ]
      .filter((x) => x !== null)
      .join("\n");
    return { status: res.status, html: html.slice(0, 2000), text };
  } catch (e) {
    return { status: 0, html: "", text: `Could not fetch ${url} (${String(e).slice(0, 80)})` };
  }
}
