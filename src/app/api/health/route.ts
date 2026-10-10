import { NextResponse } from "next/server";
import { hasQlooKey, QLOO_BASE } from "@/lib/qloo";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: hasQlooKey() ? "live" : "unconfigured",
    qlooKeyPresent: hasQlooKey(),
    qlooBase: QLOO_BASE,
    endpoints: ["GET /search", "GET /v2/insights", "GET /v2/tags"],
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
