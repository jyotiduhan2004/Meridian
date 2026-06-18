import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight liveness probe for uptime checks / deploy health.
export async function GET() {
  return NextResponse.json({ status: "ok", service: "meridian", time: new Date().toISOString() });
}
