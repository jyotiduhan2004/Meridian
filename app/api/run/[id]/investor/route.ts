import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = store.get(id);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const { round = 0, answer = "" } = await req.json().catch(() => ({ round: 0, answer: "" }));

  const provider = getProvider();
  const turn = await provider.complete({
    system:
      "You are Victoria, a tough but fair investor. You have the team's findings. Challenge the founder; push harder on weak answers, concede strong ones. One pointed challenge per turn.",
    prompt: answer
      ? `The founder responded: "${answer}". Push back or move on.`
      : "Open the debate with your hardest question.",
    meta: { kind: "investor", round },
  });

  return NextResponse.json({ round, turn });
}
