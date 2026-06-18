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

// Reachability of an artifact the user provided but that the live-page skills
// can't actually use — a dead URL (404) or a login wall with no credentials.
// Lets the planner pause the dependent skills with a clear reason.
export type Preflight = { url?: { ok: boolean; status: number; loginWall?: boolean } };

/** Human-readable reason a skill was skipped, given the mode + available inputs. */
function skipReason(
  meta: SkillMeta,
  available: Set<string>,
  mode: Mode,
  deadUrl?: { status: number; loginWall?: boolean },
): string {
  if (!runsInMode(meta, mode)) {
    const other = mode === "idea" ? "Product" : "Idea";
    return `only runs in ${other} mode`;
  }
  const missing = meta.inputs.filter((i) => !available.has(i));
  // A provided-but-unusable URL reads differently from "no URL was given".
  if (deadUrl && meta.inputs.includes("url")) {
    const base = deadUrl.loginWall
      ? "this URL is behind a login — add credentials in the confirm step and re-run"
      : `the deployed URL is unreachable (${deadUrl.status ? `HTTP ${deadUrl.status}` : "no response"}) — fix the deploy and re-run`;
    const others = missing.filter((i) => i !== "url");
    return others.length ? `${base}; also needs ${others.map((m) => INPUT_LABEL[m] ?? m).join(" + ")}` : base;
  }
  return `needs ${missing.map((m) => INPUT_LABEL[m] ?? m).join(" + ") || "more input"}`;
}

/**
 * Plan a run: which fan-out skills are eligible from the mode + available inputs,
 * and what's skipped. `selected`, when given, is the set of specialists the user
 * chose to run — eligible skills owned by an unselected specialist go to standby.
 */
export function planRun(
  inputs: RunInputs,
  mode: Mode,
  preflight: Preflight = {},
  selected?: Set<string>,
) {
  const reg = loadRegistry();
  const available = new Set(availableInputs(inputs));

  // Treat an unreachable URL as absent for eligibility: the live-page skills go
  // to standby with one clear reason instead of each emitting a duplicate "404"
  // finding (which would also unfairly tank the score on an undeployed app).
  const deadUrl =
    inputs.url && preflight.url && !preflight.url.ok
      ? { status: preflight.url.status, loginWall: preflight.url.loginWall }
      : undefined;
  if (deadUrl) available.delete("url");

  const eligible: string[] = [];
  const skipped: { skillId: string; specialist: string; reason: string }[] = [];

  for (const m of reg) {
    if (STAGE_SKILLS.has(m.name)) continue;
    if (!isEligible(m, available, mode)) {
      skipped.push({ skillId: m.name, specialist: m.specialist, reason: skipReason(m, available, mode, deadUrl) });
    } else if (selected && !selected.has(m.specialist)) {
      skipped.push({ skillId: m.name, specialist: m.specialist, reason: "not selected for this run" });
    } else {
      eligible.push(m.name);
    }
  }

  // order eligible skills by specialist for a tidy dashboard
  const order = (id: string) => personaFor(metaSpecialist(reg, id)).order;
  eligible.sort((a, b) => order(a) - order(b));

  return { eligible, skipped };
}

function metaSpecialist(reg: ReturnType<typeof loadRegistry>, id: string): string {
  return reg.find((m) => m.name === id)?.specialist ?? "";
}
