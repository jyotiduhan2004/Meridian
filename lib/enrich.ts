import { getTools, type RepoRead } from "@/lib/tools";
import { fetchRawHtml } from "@/lib/tools/page";
import { RunInputs } from "@/lib/schema";

// When a repo is pasted but the description/URL are missing, the repo itself
// carries the product story. We derive a description from the README + repo
// metadata (so Market + PM skills can run) and pick up a demo URL if the README
// links one (so the live-page skills can run too). The repo read is memoized,
// so this shares one fetch with the per-skill runs.

// Light markdown → text so the derived description reads cleanly.
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // code fences
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveDescription(r: RepoRead): string {
  const body = r.rawReadme ? stripMarkdown(r.rawReadme).slice(0, 1200) : "";
  return [r.description?.trim(), body].filter(Boolean).join("\n\n");
}

// Finding the *deployed app* in a README is error-prone — most links are docs,
// platforms, or badges, not the live product. Be conservative: only accept a
// link that is either labeled as a demo or hosted on a known deploy domain.
// Otherwise leave url empty so the live-page skills skip with a clear reason
// (the user can paste the real URL in the confirm step).
const BADGE = /(shields\.io|img\.shields|badge|\.svg|\.png|github\.com|githubusercontent\.com)/i;
const DEPLOY_HOST =
  /(^|\.)(vercel\.app|netlify\.app|github\.io|pages\.dev|herokuapp\.com|fly\.dev|onrender\.com|web\.app|firebaseapp\.com|surge\.sh|railway\.app|deno\.dev|workers\.dev|streamlit\.app|run\.app|appspot\.com|azurewebsites\.net|ondigitalocean\.app)$/i;
const DEMO_LABEL = /\b(demo|live|try|deployed|preview|visit|website)\b/i;

// Submission/aggregator hosts: the page lists a project's links but isn't the
// product itself, so we crawl it for the real repo + deployed URL.
const AGGREGATOR = /(^|\.)(devpost\.com|devfolio\.co|producthunt\.com|challengepost\.com|hackerearth\.com|dorahacks\.io|lablab\.ai)$/i;
// github.com paths that are not a user's repo.
const REPO_OWNER_DENY =
  /^(about|features|topics|login|join|sponsors|site|enterprise|pricing|security|customer-stories|readme|collections|apps|marketplace|explore|orgs|settings|notifications|new|organizations|devpost|newrelic)$/i;
const REPO_SUBPATH = /^(blob|tree|raw|releases|wiki|issues|pull|pulls|actions|commit|commits|blame|stargazers|watchers|forks)$/i;

// Free-typed text alongside a bare link is usually framing ("this is my repo,
// analyse it"), not a real product description. Treat such text as weak so the
// repo/page-derived description can take over.
const INSTRUCTIONY =
  /\b(analy[sz]e|review|check (this|it)|here'?s|this is (my|the)|please|can you|take a look|rate|evaluate|tell me)\b/i;
export function weakDescription(d?: string): boolean {
  if (!d) return true;
  const t = d.trim();
  if (t.length < 40) return true;
  if (INSTRUCTIONY.test(t) && t.length < 220) return true;
  return false;
}

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

/** All absolute URLs referenced in a page (href attributes + bare links). */
function pageUrls(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) set.add(m[1]);
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)) set.add(m[0]);
  return [...set].map((u) => u.replace(/[).,;]+$/, "")).filter((u) => /^https?:\/\//i.test(u));
}

/** First link on the page that looks like a real user/org repo root. */
function findRepoLink(html: string): string | undefined {
  for (const u of pageUrls(html)) {
    const m = u.match(/^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:[/#?].*)?$/i);
    if (!m) continue;
    const [, owner, repo] = m;
    if (REPO_OWNER_DENY.test(owner)) continue;
    if (REPO_SUBPATH.test(u.split("/")[5] ?? "")) continue;
    if (/\.(png|jpe?g|svg|gif|md)$/i.test(repo)) continue;
    return `https://github.com/${owner}/${repo.replace(/\.git$/, "")}`;
  }
  return undefined;
}

/** First link on the page hosted on a recognized deploy platform (not the page itself). */
function findDeployLink(html: string, self: string): string | undefined {
  const selfHost = hostOf(self);
  for (const u of pageUrls(html)) {
    const h = hostOf(u);
    if (!h || h === selfHost) continue;
    if (DEPLOY_HOST.test(h)) return u;
  }
  return undefined;
}

function pageDescription(html: string): string | undefined {
  const decode = (s: string) =>
    s.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s*[|—-]\s*Devpost\s*$/i, ""));
  const meta = decode(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      "",
  );
  const d = [title, meta].filter(Boolean).join(" — ");
  return d || undefined;
}

// Hosts that are never the product's own deployed app.
const NON_APP_HOST =
  /(github\.com|githubusercontent|shields\.io|youtube\.com|youtu\.be|google\.com|gmail\.com|example\.(com|org)|localhost|w3\.org|mozilla\.org|npmjs\.com)/i;
// A bare domain written in prose, e.g. "deployed at myapp.io". The leading
// boundary avoids matching inside emails (user@host).
const BARE_DOMAIN =
  /(?:^|[\s:=(])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})((?:\/[^\s)]*)?)/gi;

/**
 * A deployed-app URL written in free text — an explicit http(s) link first, then
 * a bare domain (so "the deployed url is myapp.io" is honored even without the
 * scheme). GitHub/badge/asset links are skipped.
 */
export function urlFromText(text: string): string | undefined {
  for (const m of text.matchAll(/https?:\/\/[^\s)\]"'<>]+/gi)) {
    const u = m[0].replace(/[).,;]+$/, "");
    if (!NON_APP_HOST.test(u) && !BADGE.test(u)) return u;
  }
  for (const m of text.matchAll(BARE_DOMAIN)) {
    const host = m[1].toLowerCase();
    const path = (m[2] ?? "").replace(/[).,;]+$/, "");
    if (NON_APP_HOST.test(host)) continue;
    if (/\.(png|jpe?g|svg|gif|md|js|tsx?|css|json|py|txt|pdf|zip)$/i.test(host + path)) continue;
    return `https://${host}${path}`;
  }
  return undefined;
}

/** Best-effort: does this URL sit behind a login wall? (password field, or a sign-in title) */
export async function detectLoginWall(url: string): Promise<boolean> {
  try {
    const html = await fetchRawHtml(url);
    if (!html) return false;
    if (/<input[^>]+type=["']password["']/i.test(html)) return true;
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    return /\b(sign[\s-]?in|log[\s-]?in|login)\b/i.test(title);
  } catch {
    return false;
  }
}

function findDemoUrl(readme?: string): string | undefined {
  if (!readme) return undefined;
  // 1) a markdown link whose text says "demo / live / try it / website"
  for (const m of readme.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi)) {
    const label = m[1];
    const url = m[2].replace(/[).,;]+$/, "");
    if (!BADGE.test(url) && DEMO_LABEL.test(label)) return url;
  }
  // 2) any link hosted on a recognized deploy platform
  for (const m of readme.matchAll(/https?:\/\/[^\s)\]"'<>]+/gi)) {
    const url = m[0].replace(/[).,;]+$/, "");
    if (BADGE.test(url)) continue;
    try {
      if (DEPLOY_HOST.test(new URL(url).hostname)) return url;
    } catch {
      /* not a parseable URL */
    }
  }
  return undefined;
}

/**
 * Resolve the real inputs from whatever the user pasted.
 *  1. If we were handed a page — especially an aggregator like a Devpost
 *     submission — crawl it for the GitHub repo + the actual deployed app URL
 *     hiding inside it, and keep the page's own description as a fallback.
 *  2. If we now have a repo, derive a (richer) description + demo URL from it.
 *  3. Description priority: repo README → aggregator page → weak typed text, so
 *     framing like "analyse this" never wins over the real product story.
 * Every step is best-effort: enrichment never breaks a run.
 */
export async function enrichInputs(inputs: RunInputs): Promise<RunInputs> {
  let out: RunInputs = { ...inputs };
  let pageDesc: string | undefined; // aggregator page description — last-resort fallback

  if (out.url) {
    const crawled = await enrichFromUrl(out);
    out = crawled.inputs;
    pageDesc = crawled.pageDesc;
  }
  // An explicitly provided URL wins: if the user wrote a deployed URL in the
  // description (not the URL field), use that rather than deriving one from the
  // repo README further down.
  if (!out.url && out.description) {
    const u = urlFromText(out.description);
    if (u) out.url = u;
  }
  // The repo README is the richest source — try it when we have a repo and the
  // description is still weak (or we couldn't find a live URL yet).
  if (out.repo && (weakDescription(out.description) || !out.url)) {
    out = await enrichFromRepo(out);
  }
  // Fall back to the aggregator page's own description if nothing better stuck.
  if (weakDescription(out.description) && pageDesc) out.description = pageDesc;
  return out;
}

/**
 * Crawl a given page for the repo + real deploy URL. Swaps an aggregator URL for
 * the real app, and returns the page's own description as a fallback.
 */
async function enrichFromUrl(inputs: RunInputs): Promise<{ inputs: RunInputs; pageDesc?: string }> {
  const url = inputs.url!;
  const isAggregator = AGGREGATOR.test(hostOf(url));
  // A normal product page we already have a repo for has nothing to add.
  if (!isAggregator && inputs.repo) return { inputs };

  try {
    const html = await fetchRawHtml(url);
    if (!html) return { inputs };
    const out = { ...inputs };
    if (!out.repo) {
      const repo = findRepoLink(html);
      if (repo) out.repo = repo;
    }
    let pageDesc: string | undefined;
    if (isAggregator) {
      // The submission page isn't the product — point the live-page skills at
      // the real app (undefined → they skip cleanly with a clear reason).
      out.url = findDeployLink(html, url);
      // Always capture the page's own description; used later only if the repo
      // doesn't supply something better.
      pageDesc = pageDescription(html);
    }
    return { inputs: out, pageDesc };
  } catch {
    return { inputs };
  }
}

/** Fill a weak description + missing demo URL from the repo README. */
async function enrichFromRepo(inputs: RunInputs): Promise<RunInputs> {
  try {
    const r = await getTools().readRepo(inputs.repo!);
    const out = { ...inputs };
    if (weakDescription(out.description)) {
      const d = deriveDescription(r);
      if (d) out.description = d;
    }
    if (!out.url) {
      const u = findDemoUrl(r.rawReadme);
      if (u) out.url = u;
    }
    return out;
  } catch {
    return inputs; // never let enrichment break a run
  }
}
