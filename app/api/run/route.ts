import { NextRequest, NextResponse } from "next/server";
import { planRun, type Preflight } from "@/lib/orchestrator";
import { enrichInputs, detectLoginWall } from "@/lib/enrich";
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
export const maxDuration = 60; // does a live preflight fetch + enrichment of the target URL

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode: Mode = body.mode === "idea" ? "idea" : "product";
  // Idea mode is concept-only (description); Product mode can derive the
  // description/URL from a pasted repo so Market + PM skills engage too.
  const inputs: RunInputs =
    mode === "product" ? await enrichInputs(body.inputs ?? {}) : body.inputs ?? {};

  // Session-only login credentials for a gated URL (never persisted — see store).
  const creds = body.credentials;
  if (creds?.email && creds?.password) {
    inputs.credentials = { email: String(creds.email), password: String(creds.password) };
  }

  // Pre-flight the deployed URL (memoized, so the skills reuse this fetch) so an
  // unreachable app — or a login wall with no credentials — pauses the live-page
  // skills with one clear reason instead of scoring an error/login page.
  let preflight: Preflight = {};
  if (inputs.url) {
    try {
      const p = await getTools().fetchPage(inputs.url);
      let ok = !urlIsDead(p.status);
      let loginWall = false;
      if (ok && !inputs.credentials && (body.needsLogin === true || (await detectLoginWall(inputs.url)))) {
        ok = false;
        loginWall = true;
      }
      preflight = { url: { ok, status: p.status, loginWall } };
    } catch {
      preflight = { url: { ok: false, status: 0 } };
    }
  }

  // Optional user selection of which specialists to run.
  const selected =
    Array.isArray(body.specialists) && body.specialists.length
      ? new Set<string>(body.specialists.map(String))
      : undefined;

  const { eligible, skipped } = planRun(inputs, mode, preflight, selected);
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
