import { NextResponse } from "next/server";
import { runTasteAgent } from "@/lib/agent";
import { hasQlooKey } from "@/lib/qloo";
import type { PlanRequest, PlanResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cache = new Map<string, { at: number; data: PlanResult }>();
const TTL = 30 * 60 * 1000;

function sanitize(body: Partial<PlanRequest>): PlanRequest {
  const clip = (s: unknown, n = 120) => (typeof s === "string" ? s.slice(0, n) : undefined);
  const household: PlanRequest["household"] = {};
  if (body.household && typeof body.household === "object") {
    for (const m of ["avery", "morgan"] as const) {
      const seeds = body.household[m];
      if (!seeds || typeof seeds !== "object") continue;
      household[m] = {};
      for (const [type, list] of Object.entries(seeds)) {
        if (Array.isArray(list))
          (household[m] as Record<string, string[]>)[type] = list
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 80))
            .slice(0, 4);
      }
    }
  }
  return {
    plan: clip(body.plan, 200)?.trim() || "Friday night in",
    city: clip(body.city, 60)?.trim() || undefined,
    cuisine: clip(body.cuisine, 40)?.trim() || undefined,
    household,
  };
}

export async function POST(req: Request) {
  if (!hasQlooKey()) {
    return NextResponse.json(
      { error: "QLOO_API_KEY is not configured on the server. Add it to .env.local (local) or the Vercel project env." },
      { status: 503 },
    );
  }
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<PlanRequest>;
    const input = sanitize(body);
    const key = JSON.stringify(input);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      return NextResponse.json({ ...hit.data, cached: true });
    }
    const result = await runTasteAgent(input);
    if (result.slots.every((s) => s.pick)) {
      if (cache.size > 200) cache.clear();
      cache.set(key, { at: Date.now(), data: result });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent failed" },
      { status: 500 },
    );
  }
}
