import { describe, it, expect } from "vitest";
import { computeVerdict } from "@/lib/scoring";
import type { Run } from "@/lib/store";
import type { SkillEnvelope } from "@/lib/schema";

const skill = (over: Partial<SkillEnvelope>): SkillEnvelope => ({
  skillId: "s",
  specialist: "QA Engineer",
  status: "done",
  score: 8,
  rubricBreakdown: [],
  findings: [],
  stance: "ship",
  ...over,
});

const run = (skills: SkillEnvelope[]): Run =>
  ({
    id: "r",
    mode: "product",
    inputs: {},
    plan: [],
    skipped: [],
    skills: Object.fromEntries(skills.map((s, i) => [`${s.skillId}-${i}`, s])),
    events: [],
    verdict: null,
    createdAt: 0,
  }) as Run;

describe("computeVerdict", () => {
  it("counts only completed specialists and renormalizes (absent ≠ zero)", () => {
    const v = computeVerdict(
      run([
        skill({ skillId: "a", specialist: "QA Engineer", score: 8 }),
        skill({ skillId: "b", specialist: "Security Engineer", score: 6 }),
        skill({ skillId: "c", specialist: "UX Designer", status: "failed", score: null }),
      ]),
    );
    const specs = v.scoreBreakdown.map((b) => b.specialist);
    expect(specs).toContain("QA Engineer");
    expect(specs).toContain("Security Engineer");
    expect(specs).not.toContain("UX Designer"); // failed → excluded, not scored 0
    expect(v.meridianScore).toBeGreaterThan(0);
    expect(v.meridianScore).toBeLessThanOrEqual(100);
  });

  it("flags a conflict when one specialist blocks and another ships", () => {
    const v = computeVerdict(
      run([
        skill({
          skillId: "a",
          specialist: "QA Engineer",
          stance: "block",
          findings: [{ title: "Broken flow", severity: "critical" }],
        }),
        skill({ skillId: "b", specialist: "Security Engineer", stance: "ship" }),
      ]),
    );
    expect(v.conflicts.length).toBeGreaterThan(0);
  });
});
