import { NextRequest, NextResponse } from "next/server";
import { extractInputs } from "@/lib/intake";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  const ex = extractInputs(String(text ?? ""));
  return NextResponse.json({
    ...ex,
    found: { url: !!ex.url, repo: !!ex.repo, description: !!ex.description },
  });
}
