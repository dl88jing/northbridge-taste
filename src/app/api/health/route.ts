import { NextResponse } from "next/server";
import { hasQlooKey, QLOO_BASE, qlooMode } from "@/lib/qloo";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: qlooMode(),
    qlooKeyPresent: hasQlooKey(),
    qlooBase: QLOO_BASE,
    note:
      "Hackathon keys only work against https://hackathon.api.qloo.com — never staging/production.",
  });
}
