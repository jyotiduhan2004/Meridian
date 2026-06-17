import { getTools, type RepoRead } from "@/lib/tools";
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
  /(^|\.)(vercel\.app|netlify\.app|github\.io|pages\.dev|herokuapp\.com|fly\.dev|onrender\.com|web\.app|firebaseapp\.com|surge\.sh|railway\.app|deno\.dev|workers\.dev|streamlit\.app)$/i;
const DEMO_LABEL = /\b(demo|live|try|deployed|preview|visit|website)\b/i;

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

/** Fill missing description/url from the repo. No-op when there's no repo or both are present. */
export async function enrichInputs(inputs: RunInputs): Promise<RunInputs> {
  if (!inputs.repo) return inputs;
  if (inputs.description && inputs.url) return inputs;

  try {
    const r = await getTools().readRepo(inputs.repo);
    const out = { ...inputs };
    if (!out.description) {
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
