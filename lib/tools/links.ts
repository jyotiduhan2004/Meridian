import { fetchRawHtml, BROWSER_HEADERS } from "./page";

// Real internal-link checking so the QA / journey skills report ACTUAL link
// health instead of guessing route statuses from link text. Auth pages (a login
// form, or a route that redirects to login) are reachable — not broken.

export type LinkClass = "ok" | "auth" | "broken" | "error";
export type LinkCheck = { href: string; status: number; finalUrl: string; klass: LinkClass };

const LOGIN_PATH = /(login|signin|sign-in|sign_in|\/auth\b|account\/login)/i;

const normPath = (u: string): string => {
  try {
    return new URL(u).pathname.replace(/\/$/, "") || "/";
  } catch {
    return "";
  }
};

// One fetch attempt with a generous timeout; returns null on abort/network error.
async function fetchStatus(url: string): Promise<{ status: number; finalUrl: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: ctrl.signal });
    return { status: res.status, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function checkOne(path: string, abs: string): Promise<LinkCheck> {
  // One retry — a single transient timeout shouldn't read as a dead page.
  const r = (await fetchStatus(abs)) ?? (await fetchStatus(abs));
  if (!r) return { href: path, status: 0, finalUrl: abs, klass: "error" };
  const redirectedToLogin =
    normPath(r.finalUrl) !== normPath(abs) && LOGIN_PATH.test(normPath(r.finalUrl));
  let klass: LinkClass;
  if (r.status === 401 || r.status === 403 || redirectedToLogin) klass = "auth";
  else if (r.status >= 200 && r.status < 400) klass = "ok";
  else if (r.status === 404 || r.status === 410) klass = "broken";
  else klass = "error";
  return { href: path, status: r.status, finalUrl: r.finalUrl, klass };
}

// Bounded-concurrency map so we don't burst a small site into timeouts.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function checkLinks(url: string): Promise<LinkCheck[]> {
  const html = await fetchRawHtml(url);
  if (!html) return [];
  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return [];
  }

  // collect up to ~15 distinct same-origin link targets (skip the homepage)
  const targets = new Map<string, string>(); // path -> absolute url
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(raw)) continue;
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      continue;
    }
    if (abs.origin !== base.origin) continue;
    const path = abs.pathname.replace(/\/$/, "") || "/";
    if (path === "/") continue;
    if (!targets.has(path)) targets.set(path, abs.toString());
    if (targets.size >= 10) break;
  }

  const results = await pool([...targets.entries()], 5, ([path, abs]) => checkOne(path, abs));
  return results.sort((a, b) => a.href.localeCompare(b.href));
}
