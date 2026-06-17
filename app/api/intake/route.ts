import { NextRequest, NextResponse } from "next/server";
import { extractInputs } from "@/lib/intake";
import { enrichInputs } from "@/lib/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  const ex = extractInputs(String(text ?? ""));
  // If a repo was pasted, derive the description (+ demo URL) so the confirm
  // card shows them pre-filled and the Market/PM skills become eligible.
  const enriched = await enrichInputs(ex);
  return NextResponse.json({
    ...enriched,
    found: { url: !!enriched.url, repo: !!enriched.repo, description: !!enriched.description },
  });
}
