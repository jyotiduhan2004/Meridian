import { z } from "zod";
import { loadSkill } from "./registry";
import { getProvider } from "@/lib/llm";
import { getTools } from "@/lib/tools";
import { personaFor } from "@/lib/personas";
import {
  RunInputs,
  SkillEnvelope,
  SkillMeta,
  SEVERITIES,
  STANCES,
  EFFORTS,
  Severity,
  Stance,
  Effort,
} from "@/lib/schema";

const AnalysisSchema = z.object({
  score: z.number(),
  stance: z.string().optional(),
  rubricBreakdown: z
    .array(z.object({ dimension: z.string(), max: z.number(), earned: z.number() }))
    .optional(),
  findings: z
    .array(
      z.object({
        title: z.string(),
        severity: z.string().optional(),
        evidence: z.string().optional(),
        fix: z.string().optional(),
        effort: z.string().optional(),
      }),
    )
    .optional(),
  note: z.string().optional(),
});

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const norm = (s?: string) => (s ?? "").trim().toLowerCase();

const asSeverity = (s?: string): Severity =>
  (SEVERITIES as readonly string[]).includes(norm(s)) ? (norm(s) as Severity) : "low";
const asEffort = (s?: string): Effort | undefined =>
  (EFFORTS as readonly string[]).includes(norm(s)) ? (norm(s) as Effort) : undefined;
const asStance = (s?: string): Stance => {
  const v = norm(s);
  // exact, then word-ish containment (models sometimes wrap the stance in prose)
  for (const t of STANCES) if (v === t) return t as Stance;
  for (const t of ["block", "fix-first", "ship"] as const) if (v.includes(t)) return t;
  return "n/a";
};

// Strip markdown fences / surrounding prose, then parse the JSON object. Models
// occasionally emit JSON with trailing commas (`,}` / `,]`), which is invalid —
// retry once with those stripped before giving up.
function parseAnalysis(raw: string): unknown {
  let t = raw.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!t.startsWith("{")) {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a !== -1 && b > a) t = t.slice(a, b + 1);
  }
  try {
    return JSON.parse(t);
  } catch {
    return JSON.parse(t.replace(/,(\s*[}\]])/g, "$1"));
  }
}

// Market skills that benefit from live web search.
const SEARCH_SKILLS = new Set([
  "analyze-competitors",
  "size-market",
  "assess-pricing",
  "check-discoverability",
]);
// Skills that need to *see* the page — a live screenshot is attached as a vision image.
const VISION_SKILLS = new Set(["audit-visual-ux", "walk-user-journey"]);

type Evidence = { text: string; images: { mimeType: string; dataBase64: string }[] };

/** Gather real evidence for the artifacts this skill needs. */
async function gatherEvidence(meta: SkillMeta, inputs: RunInputs): Promise<Evidence> {
  const tools = getTools();
  const needs = (i: string) => meta.inputs.includes(i);
  const parts: string[] = [];
  const images: Evidence["images"] = [];

  if (needs("repo") && inputs.repo) {
    const r = await tools.readRepo(inputs.repo);
    parts.push(`## Repository evidence\n${r.readme ?? r.tree.join("\n")}`);
  }
  if (needs("url") && inputs.url) {
    const p = await tools.fetchPage(inputs.url);
    parts.push(`## Live page evidence (HTTP ${p.status})\n${p.text}`);
  }
  if (VISION_SKILLS.has(meta.name) && inputs.url) {
    const shot = await tools.screenshot(inputs.url, inputs.credentials);
    if (shot.image) {
      images.push(shot.image);
      parts.push(`## Screenshot\nA live screenshot of the page is attached — judge the actual visual experience.`);
    } else if (shot.text) {
      parts.push(`## Screenshot\n${shot.text}`);
    }
  }
  if (SEARCH_SKILLS.has(meta.name) && inputs.description) {
    const results = await tools.search(inputs.description.slice(0, 160));
    if (results.length) {
      parts.push(
        `## Web search evidence\n` +
          results.map((s) => `- ${s.title} (${s.url})\n  ${s.snippet}`).join("\n"),
      );
    }
  }
  return { text: parts.join("\n\n"), images };
}

function buildPrompt(body: string, inputs: RunInputs, evidence: string): string {
  const ctx = [
    inputs.url ? `Deployed URL: ${inputs.url}` : null,
    inputs.repo ? `GitHub repo: ${inputs.repo}` : null,
    inputs.description ? `Description: ${inputs.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "Run the skill below on the project and return ONLY a JSON object with keys:",
    "score (0-10 number), stance (EXACTLY one of: block | fix-first | ship | n/a),",
    "rubricBreakdown ([{dimension, max, earned}]),",
    "findings ([{title, severity(critical|high|medium|low|nit), evidence, fix, effort(easy|medium|hard)}]),",
    "note (optional string).",
    "Base every finding on the EVIDENCE below — cite file paths / specifics. Do not invent facts.",
    "",
    "=== SKILL ===",
    body.slice(0, 6000),
    "",
    "=== PROJECT ===",
    ctx || "(no artifacts provided)",
    "",
    "=== EVIDENCE ===",
    evidence || "(no evidence could be retrieved — reason carefully from the project info above and lower confidence accordingly)",
  ].join("\n");
}

/** Run one skill in isolation, wearing its specialist's persona. Returns the standard envelope. */
export async function runSkill(skillId: string, inputs: RunInputs): Promise<SkillEnvelope> {
  const loaded = loadSkill(skillId);
  if (!loaded) {
    return {
      skillId,
      specialist: "",
      status: "skipped",
      score: null,
      rubricBreakdown: [],
      findings: [],
      stance: "n/a",
      note: "skill not found",
    };
  }

  const { meta, body } = loaded;
  const p = personaFor(meta.specialist);
  const provider = getProvider();
  const system = `You are the ${p.role} on a product-review team. Be direct, specific, and evidence-based. Never invent precise numbers — give ranges with reasoning.`;

  try {
    const evidence = await gatherEvidence(meta, inputs);
    const raw = await provider.complete({
      system,
      prompt: buildPrompt(body, inputs, evidence.text),
      images: evidence.images.length ? evidence.images : undefined,
      json: true,
      meta: { skillId, specialist: meta.specialist },
    });
    const a = AnalysisSchema.parse(parseAnalysis(raw));
    return {
      skillId,
      specialist: meta.specialist,
      status: "done",
      score: clamp(a.score, 0, 10),
      rubricBreakdown: a.rubricBreakdown ?? [],
      findings: (a.findings ?? []).map((f) => ({
        title: f.title,
        severity: asSeverity(f.severity),
        evidence: f.evidence,
        fix: f.fix,
        effort: asEffort(f.effort),
      })),
      stance: asStance(a.stance),
      note: a.note,
    };
  } catch (e) {
    return {
      skillId,
      specialist: meta.specialist,
      status: "failed",
      score: null,
      rubricBreakdown: [],
      findings: [],
      stance: "n/a",
      note: `error: ${String(e).slice(0, 120)}`,
    };
  }
}
