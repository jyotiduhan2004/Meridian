import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { computeVerdict } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = store.get(id);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

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
  store.setVerdict(id, verdict);
  return NextResponse.json(verdict);
}
