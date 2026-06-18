import { NextResponse } from "next/server";
import { store, Run } from "@/lib/store";
import { getProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Turn = { who: "investor" | "you"; text: string };

// Build a grounded brief from the real run so THE INVESTOR challenges THIS
// project, not a generic startup it invents.
function projectBrief(run: Run | undefined): string {
  if (!run) return "(project unavailable)";
  const desc = run.inputs?.description?.slice(0, 900) || "(no written description — infer from the findings)";
  const v = run.verdict;
  const fixes = (v?.fixList ?? [])
    .slice(0, 6)
    .map((f) => `- [${f.severity}] ${f.title}`)
    .join("\n");
  return [
    `PRODUCT: ${desc}`,
    v ? `Meridian Score: ${v.meridianScore}/100 — verdict: ${v.verdict}.` : null,
    fixes ? `Top issues the team surfaced:\n${fixes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await store.get(id);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const { answer = "", history = [] } = await req
    .json()
    .catch(() => ({ answer: "", history: [] }));

  const brief = projectBrief(run);
  const transcript = (history as Turn[])
    .map((t) => `${t.who === "investor" ? "Investor" : "Founder"}: ${t.text}`)
    .join("\n");

  const system = [
    "You are THE INVESTOR — a sharp, tough-but-fair venture investor grilling a founder about the SPECIFIC product described below.",
    "Hard rules:",
    "- Ground every question in the ACTUAL product and the team's findings below. NEVER invent facts, numbers, or claims the founder hasn't made — no fictional pitch deck, market-share %, churn, CAC, or revenue projections that aren't in the brief.",
    "- If the founder asks what the product is or pushes back, briefly restate it from the brief in your own words, then ask your next question. Don't get evasive or repeat yourself.",
    "- One concrete, pointed challenge per turn, tied to a real weakness (a top issue, a thin market, a security/scale risk, an unclear path to money). Be specific to this product.",
    "- Concede genuinely strong answers and move on; push harder only on hand-wavy ones. Stay in character: 2–4 sentences, no stage directions.",
    "",
    "=== PROJECT BRIEF & TEAM FINDINGS ===",
    brief,
  ].join("\n");

  const prompt = answer
    ? `${transcript ? `Conversation so far:\n${transcript}\n\n` : ""}Founder just said: "${answer}"\n\nRespond as THE INVESTOR — react to that specific answer, then ask your next grounded question.`
    : "Open the debate: lead with your hardest question, grounded in a real, specific weakness from the brief above.";

  try {
    const turn = await getProvider().complete({ system, prompt, meta: { kind: "investor" } });
    return NextResponse.json({ turn });
  } catch (e) {
    const rateLimited = /429|quota/i.test(String(e));
    return NextResponse.json({
      turn: rateLimited
        ? "(The investor steps out — the model is rate-limited right now. Try again in a minute, or switch to stub mode for an uninterrupted run.)"
        : "(The investor couldn't respond just now — please try again.)",
    });
  }
}
