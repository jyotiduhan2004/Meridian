import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { runSkill } from "@/lib/skills/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> },
) {
  const { id, skillId } = await params;
  const run = store.get(id);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const pending = run.skills[skillId];
  if (pending) store.putSkill(id, { ...pending, status: "running" });

  const env = await runSkill(skillId, run.inputs);
  store.putSkill(id, env);

  return NextResponse.json(env);
}
