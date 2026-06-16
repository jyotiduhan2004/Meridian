import { LLMImage } from "@/lib/llm/types";

// Shared tool layer. Skills request actions; this layer performs them.
// Real adapters (Browserless / Tavily / GitHub) are wired in when keys are present;
// until then a stub keeps the loop runnable.

export type SearchResult = { title: string; url: string; snippet: string };
export type PageFetch = { status: number; html: string; text: string };
export type RepoRead = { tree: string[]; readme?: string };

export interface Tools {
  /** screenshot a URL for the UX skill (returns a vision image when available) */
  screenshot(url: string): Promise<{ image?: LLMImage; text?: string }>;
  /** fetch a page's HTML/text */
  fetchPage(url: string): Promise<PageFetch>;
  /** web search for the Market skills */
  search(query: string): Promise<SearchResult[]>;
  /** read a public GitHub repo's structure + README */
  readRepo(repoUrl: string): Promise<RepoRead>;
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
    return { tree: ["README.md", "package.json", "src/"], readme: `[stub repo] ${repoUrl}` };
  },
};

export function getTools(): Tools {
  // TODO(M5): return real adapters when BROWSERLESS_TOKEN / TAVILY_API_KEY are set.
  return stubTools;
}
