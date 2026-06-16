import { loadRegistry } from "@/lib/skills/registry";
import { isEligible, availableInputs, RunInputs, Mode } from "@/lib/schema";
import { personaFor } from "@/lib/personas";

// Stage skills run outside the parallel fan-out: synthesize-verdict is the PM
// synthesis (stage 2); investor-debate is the boss-battle (stage 3).
export const STAGE_SKILLS = new Set(["synthesize-verdict", "investor-debate"]);

/** Plan a run: which fan-out skills are eligible from the available inputs, and what's skipped. */
export function planRun(inputs: RunInputs, _mode: Mode) {
  const reg = loadRegistry();
  const available = availableInputs(inputs);

  const eligible: string[] = [];
  const skipped: { skillId: string; reason: string }[] = [];

  for (const m of reg) {
    if (STAGE_SKILLS.has(m.name)) continue;
    if (isEligible(m, available)) eligible.push(m.name);
    else skipped.push({ skillId: m.name, reason: `needs ${m.inputs.join(" + ") || "more input"}` });
  }

  // order eligible skills by specialist for a tidy dashboard
  const order = (id: string) => personaFor(metaSpecialist(reg, id)).order;
  eligible.sort((a, b) => order(a) - order(b));

  return { eligible, skipped };
}

function metaSpecialist(reg: ReturnType<typeof loadRegistry>, id: string): string {
  return reg.find((m) => m.name === id)?.specialist ?? "";
}
