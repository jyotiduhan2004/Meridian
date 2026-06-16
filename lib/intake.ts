export type Extracted = {
  url?: string;
  repo?: string;
  description?: string;
};

const trimPunct = (s: string) => s.replace(/[).,;]+$/, "");

/**
 * Smart Intake extraction: pull a deployed URL, a GitHub repo, and a description
 * out of free-pasted text (handles a whole project description / submission).
 */
export function extractInputs(text: string): Extracted {
  const repoMatch = text.match(/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/i);
  const repo = repoMatch ? trimPunct(repoMatch[0]) : undefined;

  const urls = [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((m) => trimPunct(m[0]));
  const url = urls.find((u) => !/github\.com/i.test(u));

  const description =
    text
      .replace(/https?:\/\/[^\s)]+/gi, "")
      .replace(/\s+/g, " ")
      .trim() || undefined;

  return { url, repo, description };
}
