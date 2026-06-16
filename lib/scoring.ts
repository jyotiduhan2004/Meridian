import { Run, Verdict } from "@/lib/store";
import { SPECIALIST_WEIGHTS } from "@/lib/personas";

const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  nit: 4,
};

/**
 * Transparent, deterministic synthesis: skill scores → specialist scores →
 * Meridian Score /100 (weighted, renormalized over the specialists present).
 * Plus conflict detection (block vs ship) and a severity-ranked fix list.
 */
export function computeVerdict(run: Run): NonNullable<Verdict> {
  const done = Object.values(run.skills).filter(
    (s) => (s.status === "done" || s.status === "partial") && s.score != null,
  );

  // specialist score = average of that specialist's skill scores
  const bySpec: Record<string, number[]> = {};
  for (const s of done) (bySpec[s.specialist] ??= []).push(s.score as number);

  const scoreBreakdown = Object.entries(bySpec)
    .filter(([spec]) => SPECIALIST_WEIGHTS[spec] != null)
    .map(([spec, arr]) => ({
      specialist: spec,
      score: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
      weight: SPECIALIST_WEIGHTS[spec],
    }));

  let num = 0;
  let den = 0;
  for (const b of scoreBreakdown) {
    num += (b.score / 10) * b.weight;
    den += b.weight;
  }
  const meridianScore = den ? Math.round((num / den) * 100) : 0;

  // conflicts: a skill says "block" while another says "ship"
  const blocks = done.filter((s) => s.stance === "block");
  const ships = done.filter((s) => s.stance === "ship");
  const conflicts =
    blocks.length && ships.length
      ? [
          {
            topic: "Launch timing",
            a: `${blocks[0].specialist}: block — ${blocks[0].findings[0]?.title ?? "blocker"}`,
            b: `${ships[0].specialist}: ship`,
            resolution:
              "Fix the blocker first (it's cheap), then ship the rest behind a feature flag.",
          },
        ]
      : [];

  const fixList = done
    .flatMap((s) => s.findings.map((f) => ({ title: f.title, severity: f.severity, skillId: s.skillId })))
    .sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9))
    .slice(0, 8);

  const verdict: "ship" | "ship-with-fixes" | "not-yet" =
    meridianScore >= 80 ? "ship" : meridianScore >= 60 ? "ship-with-fixes" : "not-yet";

  return { meridianScore, scoreBreakdown, conflicts, fixList, verdict, note: "" };
}
