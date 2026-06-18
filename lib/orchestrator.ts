import { loadRegistry } from "@/lib/skills/registry";
import { isEligible, runsInMode, availableInputs, RunInputs, Mode, SkillMeta } from "@/lib/schema";
import { personaFor } from "@/lib/personas";

// Stage skills run outside the parallel fan-out: synthesize-verdict is the PM
// synthesis (stage 2); investor-debate is the boss-battle (stage 3).
export const STAGE_SKILLS = new Set(["synthesize-verdict", "investor-debate"]);

const INPUT_LABEL: Record<string, string> = {
  url: "a live deployed URL",
  repo: "a GitHub repo",
  description: "a product description",
};

// Reachability of an artifact the user provided but that turned out to be dead
// (e.g. a deployed URL returning 404). Lets the planner pause the dependent
// skills with a clear reason instead of running them against an error page.
export type Preflight = { url?: { ok: boolean; status: number } };

/** Human-readable reason a skill was skipped, given the mode + available inputs. */
function skipReason(
  meta: SkillMeta,
  available: Set<string>,
  mode: Mode,
  deadUrl?: { status: number },
): string {
  if (!runsInMode(meta, mode)) {
    const other = mode === "idea" ? "Product" : "Idea";
    return `only runs in ${other} mode`;
  }
  const missing = meta.inputs.filter((i) => !available.has(i));
  // A provided-but-unreachable URL reads differently from "no URL was given".
  if (deadUrl && meta.inputs.includes("url")) {
    const code = deadUrl.status ? `HTTP ${deadUrl.status}` : "no response";
    const base = `the deployed URL is unreachable (${code}) — fix the deploy and re-run`;
    const others = missing.filter((i) => i !== "url");
    return others.length ? `${base}; also needs ${others.map((m) => INPUT_LABEL[m] ?? m).join(" + ")}` : base;
  }
  return `needs ${missing.map((m) => INPUT_LABEL[m] ?? m).join(" + ") || "more input"}`;
}

/** Plan a run: which fan-out skills are eligible from the mode + available inputs, and what's skipped. */
export function planRun(inputs: RunInputs, mode: Mode, preflight: Preflight = {}) {
  const reg = loadRegistry();
  const available = new Set(availableInputs(inputs));

  // Treat an unreachable URL as absent for eligibility: the live-page skills go
  // to standby with one clear reason instead of each emitting a duplicate "404"
  // finding (which would also unfairly tank the score on an undeployed app).
  const deadUrl =
    inputs.url && preflight.url && !preflight.url.ok ? { status: preflight.url.status } : undefined;
  if (deadUrl) available.delete("url");

  const eligible: string[] = [];
  const skipped: { skillId: string; specialist: string; reason: string }[] = [];

  for (const m of reg) {
    if (STAGE_SKILLS.has(m.name)) continue;
    if (isEligible(m, available, mode)) eligible.push(m.name);
    else skipped.push({ skillId: m.name, specialist: m.specialist, reason: skipReason(m, available, mode, deadUrl) });
  }

  // order eligible skills by specialist for a tidy dashboard
  const order = (id: string) => personaFor(metaSpecialist(reg, id)).order;
  eligible.sort((a, b) => order(a) - order(b));

  return { eligible, skipped };
}

function metaSpecialist(reg: ReturnType<typeof loadRegistry>, id: string): string {
  return reg.find((m) => m.name === id)?.specialist ?? "";
}
