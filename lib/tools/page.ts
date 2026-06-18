import type { PageFetch } from "./index";

// Real page fetcher: GET the URL, strip tags to readable text. No key needed.
// Used by the url-based skills (UX copy, discoverability, launch readiness, etc.)
// for text grounding; live screenshots come later via Browserless.

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

// Full raw HTML (untruncated) for link extraction — used by intake enrichment to
// pull the real repo + deployed URL out of an aggregator page (e.g. a Devpost
// submission). Scripts/styles/comments are stripped so analytics noise (stray
// github/CDN links inside <script>) doesn't pollute extraction.
export async function fetchRawHtml(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; meridian-review/0.1)", Accept: "text/html" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; meridian-review/0.1)", Accept: "text/html" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const html = await res.text();
    const title = titleOf(html);
    const desc = metaDescription(html);
    const body = htmlToText(html).slice(0, 8000);
    const text = [
      title ? `Page title: ${title}` : null,
      desc ? `Meta description: ${desc}` : null,
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
