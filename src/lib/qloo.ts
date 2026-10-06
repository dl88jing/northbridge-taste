/**
 * Qloo hackathon client.
 * Base URL: https://hackathon.api.qloo.com
 * Auth: X-Api-Key header
 * Endpoints used: GET /search, GET /v2/insights
 * Never use legacy /recs or /recommendations.
 */
import {
  ENTITY_URN,
  URN_TO_TYPE,
  type EntityType,
  type QlooEntity,
} from "./types";
import { mockInsights, mockSearch } from "./mock-data";

export const QLOO_BASE =
  process.env.QLOO_BASE_URL?.replace(/\/$/, "") ||
  "https://hackathon.api.qloo.com";

export function hasQlooKey(): boolean {
  return Boolean(process.env.QLOO_API_KEY?.trim());
}

export function qlooMode(): "live" | "mock" {
  return hasQlooKey() ? "live" : "mock";
}

function headers(): HeadersInit {
  const key = process.env.QLOO_API_KEY?.trim();
  if (!key) throw new Error("QLOO_API_KEY missing");
  return {
    "X-Api-Key": key,
    Accept: "application/json",
  };
}

function normalizeEntity(raw: Record<string, unknown>): QlooEntity | null {
  const id = String(raw.entity_id ?? raw.id ?? "");
  const name = String(raw.name ?? "");
  if (!id || !name) return null;
  const typeUrn = String(raw.type ?? raw.entity_type ?? "");
  const type =
    URN_TO_TYPE[typeUrn] ??
    (typeUrn.replace("urn:entity:", "") as EntityType) ??
    "brand";
  const tagsRaw = (raw.tags as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    id,
    name,
    type: (Object.keys(ENTITY_URN).includes(type) ? type : "brand") as EntityType,
    popularity:
      typeof raw.popularity === "number" ? raw.popularity : undefined,
    properties: (raw.properties as Record<string, unknown>) ?? undefined,
    tags: tagsRaw.map((t) => ({
      name: t.name ? String(t.name) : undefined,
      id: t.id ? String(t.id) : undefined,
    })),
    mock: false,
  };
}

/** GET /search?query=&types= */
export async function searchEntities(
  query: string,
  type?: EntityType,
  limit = 5,
): Promise<QlooEntity[]> {
  if (!hasQlooKey()) {
    return mockSearch(query, type);
  }

  const params = new URLSearchParams({
    query,
    take: String(limit),
  });
  // Hackathon /search accepts `types` as urn:entity:* (see developer guide)
  if (type) params.set("types", ENTITY_URN[type]);

  const url = `${QLOO_BASE}/search?${params.toString()}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qloo /search ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    results?: Record<string, unknown>[];
    entities?: Record<string, unknown>[];
  };
  const list = data.results ?? data.entities ?? [];
  return list
    .map((r) => normalizeEntity(r))
    .filter((e): e is QlooEntity => Boolean(e));
}

/** GET /v2/insights?filter.type=&signal.interests.entities=&take= */
export async function getInsights(opts: {
  filterType: EntityType;
  signalEntityIds: string[];
  take?: number;
}): Promise<QlooEntity[]> {
  const take = opts.take ?? 5;
  if (!hasQlooKey()) {
    return mockInsights(opts.filterType, opts.signalEntityIds, take);
  }

  const params = new URLSearchParams({
    "filter.type": ENTITY_URN[opts.filterType],
    take: String(take),
  });
  // Docs: signal.interests.entities as JSON array string of entity IDs
  if (opts.signalEntityIds.length > 0) {
    params.set(
      "signal.interests.entities",
      JSON.stringify(opts.signalEntityIds),
    );
  }

  const url = `${QLOO_BASE}/v2/insights?${params.toString()}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qloo /v2/insights ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    results?: { entities?: Record<string, unknown>[] };
    entities?: Record<string, unknown>[];
  };
  const list = data.results?.entities ?? data.entities ?? [];
  return list
    .map((r) => normalizeEntity(r))
    .filter((e): e is QlooEntity => Boolean(e));
}
