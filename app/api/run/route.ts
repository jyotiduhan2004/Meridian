import { NextRequest, NextResponse } from "next/server";
import { planRun, type Preflight } from "@/lib/orchestrator";
import { enrichInputs } from "@/lib/enrich";
import { getTools } from "@/lib/tools";
import { store, Run } from "@/lib/store";
import { loadRegistry } from "@/lib/skills/registry";
import { SkillEnvelope, RunInputs, Mode } from "@/lib/schema";

// A deployed URL is "dead" (not analyzable) when it's missing, gone, or erroring.
function urlIsDead(status: number): boolean {
  return status === 0 || status === 404 || status === 410 || status >= 500;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode: Mode = body.mode === "idea" ? "idea" : "product";
  // Idea mode is concept-only (description); Product mode can derive the
  // description/URL from a pasted repo so Market + PM skills engage too.
  const inputs: RunInputs =
    mode === "product" ? await enrichInputs(body.inputs ?? {}) : body.inputs ?? {};

  // Pre-flight the deployed URL (memoized, so the skills reuse this fetch) so an
  // unreachable app pauses the live-page skills with one clear reason.
  let preflight: Preflight = {};
  if (inputs.url) {
    try {
      const p = await getTools().fetchPage(inputs.url);
      preflight = { url: { ok: !urlIsDead(p.status), status: p.status } };
    } catch {
      preflight = { url: { ok: false, status: 0 } };
    }
  }

  const { eligible, skipped } = planRun(inputs, mode, preflight);
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
  await store.create(run);

  return NextResponse.json({
    runId: id,
    plan: eligible.map((sid) => ({ skillId: sid, specialist: specialistOf(sid) })),
    skipped,
  });
}
