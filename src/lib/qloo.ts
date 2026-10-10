/**
 * Qloo hackathon client.
 * Base URL: https://hackathon.api.qloo.com · Auth: X-Api-Key header
 * Endpoints used: GET /search, GET /v2/insights, GET /v2/tags
 * Never uses legacy /recs or /recommendations.
 *
 * - Concurrency-capped + 429-aware retry (hackathon keys allow ~5 req/s)
 * - Private server-side caching only (in-memory + Next data cache); no Qloo
 *   response data is ever stored in the repo.
 */
import {
  ENTITY_URN,
  type EntityType,
  type QlooCallLog,
  type QlooEntity,
  type QlooTag,
} from "./types";

export const QLOO_BASE =
  process.env.QLOO_BASE_URL?.replace(/\/$/, "") ||
  "https://hackathon.api.qloo.com";

export function hasQlooKey(): boolean {
  return Boolean(process.env.QLOO_API_KEY?.trim());
}

export class QlooError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Collects every Qloo call made while answering one plan (shown in the UI). */
export class Tracer {
  calls: QlooCallLog[] = [];
}

// ---------- concurrency limiter ----------
const MAX_CONCURRENT = 4;
let active = 0;
const waiters: Array<() => void> = [];
async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((r) => waiters.push(r));
  active++;
}
function release() {
  active--;
  const next = waiters.shift();
  if (next) next();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- in-memory cache ----------
const memo = new Map<string, { at: number; ttl: number; data: unknown }>();
function memoGet(key: string): unknown | undefined {
  const hit = memo.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > hit.ttl) {
    memo.delete(key);
    return undefined;
  }
  return hit.data;
}
function memoSet(key: string, data: unknown, ttl: number) {
  if (memo.size > 800) {
    const first = memo.keys().next().value;
    if (first) memo.delete(first);
  }
  memo.set(key, { at: Date.now(), ttl, data });
}

async function qlooGet(
  path: "/search" | "/v2/insights" | "/v2/tags",
  params: Record<string, string>,
  opts: { tracer?: Tracer; purpose: string; ttlSec: number },
): Promise<unknown> {
  const key = process.env.QLOO_API_KEY?.trim();
  if (!key) throw new QlooError("QLOO_API_KEY is not configured", 503);
  const qs = new URLSearchParams(params).toString();
  const url = `${QLOO_BASE}${path}?${qs}`;
  const t0 = Date.now();

  const cached = memoGet(url);
  if (cached !== undefined) {
    opts.tracer?.calls.push({
      endpoint: path,
      purpose: opts.purpose,
      params,
      status: "cache",
      results: countResults(cached),
      ms: 0,
    });
    return cached;
  }

  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    await acquire();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
        cache: "force-cache",
        next: { revalidate: opts.ttlSec },
      });
    } finally {
      release();
    }
    lastStatus = res.status;
    if (res.ok) {
      const data = await res.json();
      memoSet(url, data, opts.ttlSec * 1000);
      opts.tracer?.calls.push({
        endpoint: path,
        purpose: opts.purpose,
        params,
        status: res.status,
        results: countResults(data),
        ms: Date.now() - t0,
      });
      return data;
    }
    lastBody = await res.text().catch(() => "");
    if (res.status === 429 || res.status >= 500) {
      const reset = Number(res.headers.get("x-second-ratelimit-reset"));
      const wait =
        (Number.isFinite(reset) && reset > 0 ? reset * 1000 : 350) +
        attempt * 250 +
        Math.random() * 200;
      await sleep(wait);
      continue;
    }
    break;
  }
  opts.tracer?.calls.push({
    endpoint: path,
    purpose: opts.purpose,
    params,
    status: lastStatus,
    results: 0,
    ms: Date.now() - t0,
  });
  throw new QlooError(
    `Qloo ${path} ${lastStatus}: ${lastBody.slice(0, 160)}`,
    lastStatus,
  );
}

function countResults(data: unknown): number {
  const d = data as {
    results?: unknown[] | { entities?: unknown[]; tags?: unknown[] };
  };
  if (Array.isArray(d.results)) return d.results.length;
  return d.results?.entities?.length ?? d.results?.tags?.length ?? 0;
}

// ---------- normalization ----------
type Raw = Record<string, unknown>;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? decode(v) : undefined;
}

export function normalizeEntity(
  raw: Raw,
  fallbackType?: EntityType,
): QlooEntity | null {
  const id = str(raw.entity_id) ?? str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const urn =
    str(raw.subtype) ??
    (Array.isArray(raw.types) ? str(raw.types[0]) : undefined) ??
    str(raw.type);
  const t = urn?.replace("urn:entity:", "") as EntityType | undefined;
  const type: EntityType =
    t && t in ENTITY_URN ? t : (fallbackType ?? "brand");
  const p = (raw.properties as Raw) ?? {};
  const q = (raw.query as Raw) ?? {};
  const ext = (raw.external as Raw) ?? {};
  const loc = (raw.location as Raw) ?? {};
  const geo = (p.geocode as Raw) ?? {};
  const image = str((p.image as Raw)?.url);
  // short_descriptions is multilingual — prefer English
  const shortDesc = Array.isArray(p.short_descriptions)
    ? str(
        ((p.short_descriptions as Raw[]).find((d) => {
          const langs = (d.languages as unknown[] | undefined) ?? [];
          return langs.length === 0 || langs.some((l) => typeof l === "string" && l.startsWith("en"));
        }) as Raw | undefined)?.value,
      )
    : undefined;
  const description =
    shortDesc ??
    str(p.short_description) ??
    str(p.description)?.slice(0, 260);
  const tagsRaw = (raw.tags as Raw[] | undefined) ?? [];
  const firstId = (k: string) => {
    const arr = ext[k];
    return Array.isArray(arr) ? str((arr[0] as Raw)?.id) : undefined;
  };
  const gp = Array.isArray(ext.google_place)
    ? str((ext.google_place[0] as Raw)?.place_id)
    : undefined;
  return {
    id,
    name,
    type,
    disambiguation: str(raw.disambiguation),
    popularity: typeof raw.popularity === "number" ? raw.popularity : undefined,
    affinity: typeof q.affinity === "number" ? q.affinity : undefined,
    image,
    description,
    year:
      typeof p.release_year === "number"
        ? p.release_year
        : undefined,
    address: str(p.address),
    neighborhood: str(p.neighborhood) ?? str(geo.name),
    city: str(geo.city) ?? str(geo.locality),
    website: str(p.website),
    priceLevel: typeof p.price_level === "number" ? p.price_level : undefined,
    rating:
      typeof p.business_rating === "number"
        ? Math.round(p.business_rating * 10) / 10
        : undefined,
    lat: typeof loc.lat === "number" ? loc.lat : undefined,
    lon: typeof loc.lon === "number" ? loc.lon : undefined,
    googlePlaceId: gp,
    imdbId: firstId("imdb"),
    letterboxdId: firstId("letterboxd"),
    genres: Array.isArray(p.genres)
      ? (p.genres as unknown[]).filter((g): g is string => typeof g === "string")
      : undefined,
    tags: tagsRaw
      .map((t) => ({
        id: str(t.tag_id) ?? str(t.id) ?? "",
        name: str(t.name) ?? "",
        type: str(t.type),
      }))
      .filter((t) => t.id && t.name),
  };
}

// ---------- endpoints ----------

/** GET /search — resolve a free-text name to a Qloo entity. */
export async function searchEntities(
  query: string,
  type: EntityType | undefined,
  opts: { tracer?: Tracer; take?: number } = {},
): Promise<QlooEntity[]> {
  const params: Record<string, string> = {
    query,
    take: String(opts.take ?? 3),
  };
  if (type) params.types = ENTITY_URN[type];
  const data = (await qlooGet("/search", params, {
    tracer: opts.tracer,
    purpose: `resolve “${query}”`,
    ttlSec: 60 * 60 * 24,
  })) as { results?: Raw[] };
  return (data.results ?? [])
    .map((r) => normalizeEntity(r, type))
    .filter((e): e is QlooEntity => Boolean(e));
}

export interface InsightsQuery {
  filterType: EntityType;
  signalEntityIds: string[];
  take?: number;
  filterTags?: string[];
  /** AND the filter tags together (operator.filter.tags=intersection) */
  tagsIntersect?: boolean;
  excludeTags?: string[];
  locationQuery?: string;
  /** WKT point + radius (metres) — used for "near the previous stop" chaining */
  near?: { lat: number; lon: number; radius: number };
  /** Score only these entities (per-member fit of specific candidates) */
  resultEntityIds?: string[];
  popularityMax?: number;
}

/** GET /v2/insights — the taste graph. */
export async function getInsights(
  q: InsightsQuery,
  opts: { tracer?: Tracer; purpose: string },
): Promise<QlooEntity[]> {
  const params: Record<string, string> = {
    "filter.type": ENTITY_URN[q.filterType],
    take: String(q.take ?? 8),
  };
  if (q.signalEntityIds.length)
    params["signal.interests.entities"] = q.signalEntityIds.join(",");
  if (q.filterTags?.length) params["filter.tags"] = q.filterTags.join(",");
  if (q.tagsIntersect && (q.filterTags?.length ?? 0) > 1)
    params["operator.filter.tags"] = "intersection";
  if (q.excludeTags?.length) params["filter.exclude.tags"] = q.excludeTags.join(",");
  if (q.locationQuery) params["filter.location.query"] = q.locationQuery;
  if (q.near) {
    params["filter.location"] = `POINT(${q.near.lon} ${q.near.lat})`;
    params["filter.location.radius"] = String(q.near.radius);
  }
  if (q.resultEntityIds?.length)
    params["filter.results.entities"] = q.resultEntityIds.join(",");
  if (q.popularityMax !== undefined)
    params["filter.popularity.max"] = String(q.popularityMax);

  const data = (await qlooGet("/v2/insights", params, {
    tracer: opts.tracer,
    purpose: opts.purpose,
    ttlSec: 60 * 60 * 6,
  })) as { results?: { entities?: Raw[] } };
  return (data.results?.entities ?? [])
    .map((r) => normalizeEntity(r, q.filterType))
    .filter((e): e is QlooEntity => Boolean(e));
}

/** GET /v2/tags — resolve a cuisine / genre keyword to a Qloo tag ID. */
export async function searchTags(
  query: string,
  opts: { tracer?: Tracer; take?: number } = {},
): Promise<QlooTag[]> {
  const data = (await qlooGet(
    "/v2/tags",
    { "filter.query": query, take: String(opts.take ?? 12) },
    { tracer: opts.tracer, purpose: `tag lookup “${query}”`, ttlSec: 60 * 60 * 24 },
  )) as { results?: { tags?: Raw[] } };
  return (data.results?.tags ?? [])
    .map((t) => ({
      id: str(t.tag_id) ?? str(t.id) ?? "",
      name: str(t.name) ?? "",
      type: str(t.type),
    }))
    .filter((t) => t.id);
}
