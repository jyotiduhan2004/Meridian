import { NextRequest, NextResponse } from "next/server";
import { planRun } from "@/lib/orchestrator";
import { enrichInputs } from "@/lib/enrich";
import { store, Run } from "@/lib/store";
import { loadRegistry } from "@/lib/skills/registry";
import { SkillEnvelope, RunInputs, Mode } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode: Mode = body.mode === "idea" ? "idea" : "product";
  // Idea mode is concept-only (description); Product mode can derive the
  // description/URL from a pasted repo so Market + PM skills engage too.
  const inputs: RunInputs =
    mode === "product" ? await enrichInputs(body.inputs ?? {}) : body.inputs ?? {};

  const { eligible, skipped } = planRun(inputs, mode);
  const reg = loadRegistry();
  const specialistOf = (id: string) => reg.find((m) => m.name === id)?.specialist ?? "";

  const id = crypto.randomUUID();
  const skills: Record<string, SkillEnvelope> = {};
  for (const sid of eligible) {
    skills[sid] = {
      skillId: sid,
      specialist: specialistOf(sid),
      status: "pending",
      score: null,
      rubricBreakdown: [],
      findings: [],
      stance: "n/a",
    };
  }

  const run: Run = {
    id,
    mode,
    inputs,
    plan: eligible,
    skipped,
    skills,
    events: [{ t: Date.now(), type: "run.started" }],
    verdict: null,
    createdAt: Date.now(),
  };
  store.create(run);

  return NextResponse.json({
    runId: id,
    plan: eligible.map((sid) => ({ skillId: sid, specialist: specialistOf(sid) })),
    skipped,
  });
}
