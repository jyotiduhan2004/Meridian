import type { SearchResult } from "./index";

// Real web search via Tavily. Activated when TAVILY_API_KEY is set.
// Used by the Market specialist's skills (competitors, pricing, discoverability).

export async function tavilySearch(query: string): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: (r.content ?? "").slice(0, 400),
    }));
  } catch {
    return [];
  }
}
