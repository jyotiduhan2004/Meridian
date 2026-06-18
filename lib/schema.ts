import { z } from "zod";

// ---- Enums (code-controlled) ----
export const STATUSES = [
  "pending",
  "running",
  "done",
  "partial",
  "failed",
  "skipped",
] as const;
export type Status = (typeof STATUSES)[number];

export const STANCES = ["block", "fix-first", "ship", "n/a"] as const;
export type Stance = (typeof STANCES)[number];

export const SEVERITIES = ["critical", "high", "medium", "low", "nit"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const EFFORTS = ["easy", "medium", "hard"] as const;
export type Effort = (typeof EFFORTS)[number];

// Artifact inputs a fan-out skill can require. Stage skills (synthesize-verdict,
// investor-debate) use non-artifact inputs and are handled outside the fan-out.
export const ARTIFACT_INPUTS = ["url", "repo", "description", "hackathon_context"] as const;
export type ArtifactInput = (typeof ARTIFACT_INPUTS)[number];

// ---- Skill metadata (parsed from SKILL.md frontmatter) ----
export const SkillMeta = z.object({
  name: z.string(), // kebab-case id
  description: z.string().default(""),
  specialist: z.string(), // e.g. "QA Engineer" (kept loose; display via personas)
  tier: z.enum(["P0", "P1", "P2"]).default("P0"),
  inputs: z.array(z.string()).default([]),
  // Which run modes this skill participates in. Idea mode = concept-stage
  // (PM + Market); Product mode = the full team. Omitted ⇒ both.
  modes: z.array(z.enum(["idea", "product"])).default(["idea", "product"]),
  version: z.union([z.string(), z.number()]).optional(),
});
export type SkillMeta = z.infer<typeof SkillMeta>;

// ---- The standard result envelope every skill returns ----
export const RubricItem = z.object({
  dimension: z.string(),
  max: z.number(),
  earned: z.number(),
});
export type RubricItem = z.infer<typeof RubricItem>;

export const Finding = z.object({
  title: z.string(),
  severity: z.enum(SEVERITIES),
  evidence: z.string().optional(),
  fix: z.string().optional(),
  effort: z.enum(EFFORTS).optional(),
});
export type Finding = z.infer<typeof Finding>;

export const SkillEnvelope = z.object({
  skillId: z.string(),
  specialist: z.string(),
  status: z.enum(STATUSES),
  score: z.number().nullable(),
  rubricBreakdown: z.array(RubricItem).default([]),
  findings: z.array(Finding).default([]),
  stance: z.enum(STANCES).default("n/a"),
  note: z.string().optional(),
});
export type SkillEnvelope = z.infer<typeof SkillEnvelope>;

// ---- Run inputs ----
export type RunInputs = {
  url?: string;
  repo?: string;
  description?: string;
  hackathonContext?: string;
  /** Optional login for a gated URL. Session-only — never persisted to the DB. */
  credentials?: { email: string; password: string };
};
export type Mode = "idea" | "product";

// ---- Helpers ----
/** A fan-out (parallel) skill requires only artifact inputs. */
export function isFanoutSkill(meta: SkillMeta): boolean {
  return meta.inputs.length > 0 && meta.inputs.every((i) => (ARTIFACT_INPUTS as readonly string[]).includes(i));
}

/** Which artifact inputs are present in this run. */
export function availableInputs(inputs: RunInputs): Set<string> {
  const s = new Set<string>();
  if (inputs.url) s.add("url");
  if (inputs.repo) s.add("repo");
  if (inputs.description) s.add("description");
  if (inputs.hackathonContext) s.add("hackathon_context");
  return s;
}

/** Does this skill run in the given mode? (Omitted modes ⇒ both.) */
export function runsInMode(meta: SkillMeta, mode: Mode): boolean {
  return (meta.modes ?? ["idea", "product"]).includes(mode);
}

/** Eligible = fan-out skill that runs in this mode and has all its inputs present. */
export function isEligible(meta: SkillMeta, available: Set<string>, mode: Mode): boolean {
  return runsInMode(meta, mode) && isFanoutSkill(meta) && meta.inputs.every((i) => available.has(i));
}
