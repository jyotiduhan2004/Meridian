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
    if (targets.size >= 15) break;
  }

  const results = await Promise.all(
    [...targets.entries()].map(async ([path, abs]): Promise<LinkCheck> => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 9000);
        const res = await fetch(abs, { headers: BROWSER_HEADERS, redirect: "follow", signal: ctrl.signal });
        clearTimeout(timer);
        const finalUrl = res.url || abs;
        const redirectedToLogin = normPath(finalUrl) !== normPath(abs) && LOGIN_PATH.test(normPath(finalUrl));
        let klass: LinkClass;
        if (res.status === 401 || res.status === 403 || redirectedToLogin) klass = "auth";
        else if (res.status >= 200 && res.status < 400) klass = "ok";
        else if (res.status === 404 || res.status === 410) klass = "broken";
        else klass = "error";
        return { href: path, status: res.status, finalUrl, klass };
      } catch {
        return { href: path, status: 0, finalUrl: abs, klass: "error" };
      }
    }),
  );

  return results.sort((a, b) => a.href.localeCompare(b.href));
}
