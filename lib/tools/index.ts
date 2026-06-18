import { LLMImage } from "@/lib/llm/types";
import { readGithubRepo } from "./github";
import { fetchRealPage } from "./page";
import { tavilySearch } from "./search";
import { browserlessScreenshot, browserlessLoginScreenshot } from "./browserless";
import { checkLinks as runLinkCheck, type LinkCheck } from "./links";

// Shared tool layer. Skills request actions; this layer performs them.
// GitHub repo read + page fetch work with no key; web search needs TAVILY_API_KEY;
// live screenshots need BROWSERLESS_TOKEN. A stub keeps the loop runnable offline.

export type SearchResult = { title: string; url: string; snippet: string };
export type PageFetch = { status: number; html: string; text: string };
export type RepoRead = {
  tree: string[];
  /** composed evidence blob consumed by the skill runner */
  readme?: string;
  /** the GitHub repo's one-line description (for deriving a product description) */
  description?: string;
  /** the raw README text, separate from the composed evidence */
  rawReadme?: string;
};

export interface Tools {
  /** screenshot a URL for the UX skill (returns a vision image when available) */
  screenshot(
    url: string,
    creds?: { email: string; password: string },
  ): Promise<{ image?: LLMImage; text?: string }>;
  /** fetch a page's HTML/text */
  fetchPage(url: string): Promise<PageFetch>;
  /** web search for the Market skills */
  search(query: string): Promise<SearchResult[]>;
  /** read a public GitHub repo's structure + README */
  readRepo(repoUrl: string): Promise<RepoRead>;
  /** fetch the page's internal links and check each one's real status */
  checkLinks(url: string): Promise<LinkCheck[]>;
}

const stubTools: Tools = {
  async screenshot() {
    return { text: "[stub screenshot] page rendered." };
  },
  async fetchPage(url) {
    return { status: 200, html: "", text: `[stub page] ${url}` };
  },
  async search(query) {
    return [
      { title: "Example competitor", url: "https://example.com", snippet: `[stub result for "${query}"]` },
    ];
  },
  async readRepo(repoUrl) {
    return {
      tree: ["README.md", "package.json", "src/"],
      readme: `[stub repo] ${repoUrl}`,
      description: "A demo product for local testing.",
      rawReadme: `# Demo\nA demo product for local testing (${repoUrl}).`,
    };
  },
  async checkLinks() {
    return [];
  },
};

// Memoize evidence fetches by URL/query for the process lifetime, caching the
// Promise so the skills that fan out concurrently share a single fetch instead
// of each hammering GitHub/Tavily. (Persisted to Supabase at deploy time.)
const g = globalThis as unknown as {
  __meridianEvidence?: {
    repo: Map<string, Promise<RepoRead>>;
    page: Map<string, Promise<PageFetch>>;
    search: Map<string, Promise<SearchResult[]>>;
    shot: Map<string, Promise<{ image?: LLMImage; text?: string }>>;
    links: Map<string, Promise<LinkCheck[]>>;
  };
};
const cache =
  g.__meridianEvidence ??
  (g.__meridianEvidence = {
    repo: new Map(),
    page: new Map(),
    search: new Map(),
    shot: new Map(),
    links: new Map(),
  });

function memo<T>(map: Map<string, Promise<T>>, key: string, fn: () => Promise<T>): Promise<T> {
  const hit = map.get(key);
  if (hit) return hit;
  const p = fn().catch((e) => {
    map.delete(key); // don't cache a hard failure forever
    throw e;
  });
  map.set(key, p);
  return p;
}

const realTools: Tools = {
  // Live screenshot via Browserless when a token is set; otherwise fall back to
  // the fetched page text so the loop still runs.
  screenshot(url, creds) {
    if (process.env.BROWSERLESS_TOKEN) {
      // Authenticated capture when credentials are supplied for a gated URL.
      if (creds?.email && creds.password) {
        return memo(cache.shot, `${url}|${creds.email}`, () => browserlessLoginScreenshot(url, creds));
      }
      return memo(cache.shot, url, () => browserlessScreenshot(url));
    }
    return memo(cache.page, url, () => fetchRealPage(url)).then((p) => ({ text: p.text }));
  },
  fetchPage(url) {
    return memo(cache.page, url, () => fetchRealPage(url));
  },
  search(query) {
    return memo(cache.search, query, () => tavilySearch(query));
  },
  readRepo(repoUrl) {
    return memo(cache.repo, repoUrl, () => readGithubRepo(repoUrl));
  },
  checkLinks(url) {
    return memo(cache.links, url, () => runLinkCheck(url));
  },
};

export function getTools(): Tools {
  // Real adapters whenever we can do the fetch (GitHub + page need no key);
  // search degrades gracefully to [] without TAVILY_API_KEY. Force the offline
  // stub with TOOLS=stub (used by the canned demo path).
  if ((process.env.TOOLS ?? "").toLowerCase() === "stub") return stubTools;
  return realTools;
}
