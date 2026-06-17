import type { RepoRead } from "./index";

// Real reader for a public GitHub repo. Uses the GitHub REST API for the
// repo metadata + file tree + README, then raw.githubusercontent.com for file
// contents (raw is CDN-served and does NOT count against the API rate limit).
// Works unauthenticated (60 req/hr per IP); set GITHUB_TOKEN to raise that.

type GhMeta = {
  default_branch?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  topics?: string[];
  license?: { spdx_id?: string | null } | null;
};
type GhTreeItem = { path: string; type: string; size?: number };

const API = "https://api.github.com";

function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "meridian-review",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// Files worth reading in full (manifests, configs, entry points, docs).
const MANIFESTS = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
  "Dockerfile",
  "docker-compose.yml",
  ".github/workflows/ci.yml",
];
const ENTRY_HINTS = /(^|\/)(main|index|app|server|cli)\.(py|js|ts|tsx|go|rs|rb|java)$/i;
const CODE_EXT = /\.(py|js|ts|tsx|jsx|go|rs|rb|java|c|cpp|h)$/i;

function pickFiles(tree: GhTreeItem[]): string[] {
  const files = tree.filter((t) => t.type === "blob");
  const chosen = new Set<string>();
  // manifests + CI first
  for (const f of files) if (MANIFESTS.some((m) => f.path.toLowerCase() === m.toLowerCase())) chosen.add(f.path);
  // entry points
  for (const f of files) if (chosen.size < 8 && ENTRY_HINTS.test(f.path)) chosen.add(f.path);
  // a few more small source files for substance
  for (const f of files) {
    if (chosen.size >= 8) break;
    if (CODE_EXT.test(f.path) && (f.size ?? 99999) < 20000) chosen.add(f.path);
  }
  return [...chosen].slice(0, 8);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchRaw(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`, {
      headers: { "User-Agent": "meridian-review" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function readGithubRepo(repoUrl: string): Promise<RepoRead> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) return { tree: [], readme: `Could not parse a GitHub repo from: ${repoUrl}` };
  const { owner, repo } = parsed;

  const meta = (await fetchJson<GhMeta>(`${API}/repos/${owner}/${repo}`)) ?? {};
  const branch = meta.default_branch || "main";

  const treeData = await fetchJson<{ tree: GhTreeItem[]; truncated?: boolean }>(
    `${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
  );
  const tree = (treeData?.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);

  // README via the dedicated endpoint (handles any filename/casing).
  const readmeMeta = await fetchJson<{ content?: string; encoding?: string }>(
    `${API}/repos/${owner}/${repo}/readme`,
  );
  let readme: string | undefined;
  if (readmeMeta?.content && readmeMeta.encoding === "base64") {
    readme = Buffer.from(readmeMeta.content, "base64").toString("utf8");
  }

  // Pull a handful of key files via raw (no API-quota cost).
  const picks = treeData?.tree ? pickFiles(treeData.tree) : [];
  const files: { path: string; content: string }[] = [];
  await Promise.all(
    picks.map(async (path) => {
      const content = await fetchRaw(owner, repo, branch, path);
      if (content) files.push({ path, content: content.slice(0, 3500) });
    }),
  );

  const header = [
    `Repo: ${owner}/${repo}`,
    meta.description ? `Description: ${meta.description}` : null,
    meta.language ? `Primary language: ${meta.language}` : null,
    meta.stargazers_count != null ? `Stars: ${meta.stargazers_count}` : null,
    meta.license?.spdx_id && meta.license.spdx_id !== "NOASSERTION" ? `License: ${meta.license.spdx_id}` : null,
    meta.topics?.length ? `Topics: ${meta.topics.join(", ")}` : null,
    treeData?.truncated ? "(file tree truncated by GitHub)" : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Compose a readable evidence blob the skill prompt can consume directly.
  const fileBlocks = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");
  const composed = [
    header,
    "",
    `File tree (${tree.length} files):`,
    tree.slice(0, 250).join("\n"),
    "",
    readme ? `README:\n${readme.slice(0, 5000)}` : "(no README found)",
    files.length ? `\nKey file contents:\n${fileBlocks}` : "",
  ].join("\n");

  return {
    tree,
    readme: composed,
    description: meta.description ?? undefined,
    rawReadme: readme,
  };
}
