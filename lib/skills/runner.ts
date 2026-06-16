import { z } from "zod";
import { loadSkill } from "./registry";
import { getProvider } from "@/lib/llm";
import { personaFor } from "@/lib/personas";
import {
  RunInputs,
  SkillEnvelope,
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
const asSeverity = (s?: string): Severity =>
  (SEVERITIES as readonly string[]).includes(s ?? "") ? (s as Severity) : "low";
const asStance = (s?: string): Stance =>
  (STANCES as readonly string[]).includes(s ?? "") ? (s as Stance) : "n/a";
const asEffort = (s?: string): Effort | undefined =>
  (EFFORTS as readonly string[]).includes(s ?? "") ? (s as Effort) : undefined;

function buildPrompt(body: string, inputs: RunInputs): string {
  const ctx = [
    inputs.url ? `Deployed URL: ${inputs.url}` : null,
    inputs.repo ? `GitHub repo: ${inputs.repo}` : null,
    inputs.description ? `Description: ${inputs.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "Run the skill below on the project and return ONLY a JSON object with keys:",
    "score (0-10 number), stance (one of: block | fix-first | ship | n/a),",
    "rubricBreakdown ([{dimension, max, earned}]),",
    "findings ([{title, severity(critical|high|medium|low|nit), evidence, fix, effort(easy|medium|hard)}]),",
    "note (optional string).",
    "",
    "=== SKILL ===",
    body.slice(0, 6000),
    "",
    "=== PROJECT ===",
    ctx || "(no artifacts provided)",
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
  const system = `You are ${p.persona}, the ${p.display} on a product-review team. Be direct, specific, and evidence-based. Never invent precise numbers — give ranges with reasoning.`;

  try {
    const raw = await provider.complete({
      system,
      prompt: buildPrompt(body, inputs),
      json: true,
      meta: { skillId, specialist: meta.specialist },
    });
    const a = AnalysisSchema.parse(JSON.parse(raw));
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
