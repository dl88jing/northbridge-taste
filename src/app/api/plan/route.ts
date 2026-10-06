import { NextResponse } from "next/server";
import { runTasteAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { plan?: string };
    const plan = (body.plan ?? "").trim() || "Friday night in";
    const result = await runTasteAgent(plan);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Agent failed",
      },
      { status: 500 },
    );
  }
}
