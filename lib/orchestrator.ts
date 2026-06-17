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

/** Human-readable reason a skill was skipped, given the mode + available inputs. */
function skipReason(meta: SkillMeta, available: Set<string>, mode: Mode): string {
  if (!runsInMode(meta, mode)) {
    const other = mode === "idea" ? "Product" : "Idea";
    return `only runs in ${other} mode`;
  }
  const missing = meta.inputs.filter((i) => !available.has(i));
  return `needs ${missing.map((m) => INPUT_LABEL[m] ?? m).join(" + ") || "more input"}`;
}

/** Plan a run: which fan-out skills are eligible from the mode + available inputs, and what's skipped. */
export function planRun(inputs: RunInputs, mode: Mode) {
  const reg = loadRegistry();
  const available = availableInputs(inputs);

  const eligible: string[] = [];
  const skipped: { skillId: string; specialist: string; reason: string }[] = [];

  for (const m of reg) {
    if (STAGE_SKILLS.has(m.name)) continue;
    if (isEligible(m, available, mode)) eligible.push(m.name);
    else skipped.push({ skillId: m.name, specialist: m.specialist, reason: skipReason(m, available, mode) });
  }

  // order eligible skills by specialist for a tidy dashboard
  const order = (id: string) => personaFor(metaSpecialist(reg, id)).order;
  eligible.sort((a, b) => order(a) - order(b));

  return { eligible, skipped };
}

function metaSpecialist(reg: ReturnType<typeof loadRegistry>, id: string): string {
  return reg.find((m) => m.name === id)?.specialist ?? "";
}
