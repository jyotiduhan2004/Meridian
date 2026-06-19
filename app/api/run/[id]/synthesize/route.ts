import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { computeVerdict } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const force = new URL(req.url).searchParams.get("force") === "1";
  const run = await store.get(id);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  // Hold while skills are still settling (the client retries on 202) so we never persist a
  // premature score-0 — UNLESS the client forces. `force` is its escape when a skill is
  // genuinely stuck (e.g. killed at the 60s function limit) so one slow skill can't block
  // the whole verdict.
  const inFlight = Object.entries(run.skills).filter(
    ([, s]) => s.status === "pending" || s.status === "running",
  );
  if (inFlight.length > 0 && !force) {
    return NextResponse.json({ notReady: true, inFlight: inFlight.length }, { status: 202 });
  }
  // Forced finalize: mark any still-in-flight skill as failed so it's terminal — the score
  // then renormalizes over the specialists that actually finished.
  if (force) {
    for (const [sid, sk] of inFlight) {
      run.skills[sid] = { ...sk, status: "failed" as const };
      await store.putSkill(id, run.skills[sid]);
    }
  }

  const base = computeVerdict(run);
  const analyzed = base.scoreBreakdown.length > 0;
  const note = !analyzed
    ? "Couldn't score this run — every specialist's analysis errored (usually a transient model rate-limit). Re-run to try again."
    : base.verdict === "ship"
      ? "Solid — ship it. Address the small items when convenient."
      : base.verdict === "ship-with-fixes"
        ? "Close. Fix the blockers first (they're cheap), then ship the rest behind a flag."
        : "Not yet — the critical issues need to be resolved before launch.";

  const verdict = { ...base, note };
  await store.setVerdict(id, verdict);
  return NextResponse.json(verdict);
}
