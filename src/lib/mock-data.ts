import type { EntityType, QlooEntity } from "./types";

/** Labeled fixture entities used when QLOO_API_KEY is absent. */
const FIXTURES: Record<string, QlooEntity> = {
  "past-lives": {
    id: "mock:movie:past-lives",
    name: "Past Lives",
    type: "movie",
    popularity: 0.82,
    mock: true,
    tags: [{ name: "drama" }, { name: "romance" }],
  },
  dune: {
    id: "mock:movie:dune",
    name: "Dune",
    type: "movie",
    popularity: 0.91,
    mock: true,
    tags: [{ name: "sci-fi" }, { name: "epic" }],
  },
  khruangbin: {
    id: "mock:artist:khruangbin",
    name: "Khruangbin",
    type: "artist",
    popularity: 0.78,
    mock: true,
    tags: [{ name: "psychedelic" }, { name: "instrumental" }],
  },
  "tame-impala": {
    id: "mock:artist:tame-impala",
    name: "Tame Impala",
    type: "artist",
    popularity: 0.88,
    mock: true,
    tags: [{ name: "psych-rock" }],
  },
  "chez-panisse": {
    id: "mock:place:chez-panisse",
    name: "Chez Panisse",
    type: "place",
    popularity: 0.74,
    mock: true,
    tags: [{ name: "farm-to-table" }, { name: "california" }],
  },
  momofuku: {
    id: "mock:place:momofuku",
    name: "Momofuku Noodle Bar",
    type: "place",
    popularity: 0.8,
    mock: true,
    tags: [{ name: "noodles" }, { name: "asian" }],
  },
  kyoto: {
    id: "mock:destination:kyoto",
    name: "Kyoto",
    type: "destination",
    popularity: 0.9,
    mock: true,
    tags: [{ name: "temples" }, { name: "quiet" }],
  },
  "mexico-city": {
    id: "mock:destination:mexico-city",
    name: "Mexico City",
    type: "destination",
    popularity: 0.87,
    mock: true,
    tags: [{ name: "food" }, { name: "art" }],
  },
  severance: {
    id: "mock:tv_show:severance",
    name: "Severance",
    type: "tv_show",
    popularity: 0.89,
    mock: true,
    tags: [{ name: "thriller" }, { name: "prestige" }],
  },
  "the-bear": {
    id: "mock:tv_show:the-bear",
    name: "The Bear",
    type: "tv_show",
    popularity: 0.9,
    mock: true,
    tags: [{ name: "drama" }, { name: "food" }],
  },
  aesop: {
    id: "mock:brand:aesop",
    name: "Aesop",
    type: "brand",
    popularity: 0.76,
    mock: true,
    tags: [{ name: "wellness" }, { name: "design" }],
  },
  muji: {
    id: "mock:brand:muji",
    name: "Muji",
    type: "brand",
    popularity: 0.72,
    mock: true,
    tags: [{ name: "minimal" }],
  },
  // Cross-domain insight fixtures (what /v2/insights would return)
  "aftersun": {
    id: "mock:movie:aftersun",
    name: "Aftersun",
    type: "movie",
    popularity: 0.79,
    mock: true,
    tags: [{ name: "drama" }, { name: "intimate" }],
  },
  "perfect-days": {
    id: "mock:movie:perfect-days",
    name: "Perfect Days",
    type: "movie",
    popularity: 0.77,
    mock: true,
    tags: [{ name: "quiet" }, { name: "japan" }],
  },
  "arrival-rec": {
    id: "mock:movie:arrival",
    name: "Arrival",
    type: "movie",
    popularity: 0.85,
    mock: true,
    tags: [{ name: "sci-fi" }],
  },
  "floating-points": {
    id: "mock:artist:floating-points",
    name: "Floating Points",
    type: "artist",
    popularity: 0.7,
    mock: true,
    tags: [{ name: "electronic" }, { name: "jazz" }],
  },
  "bonobo": {
    id: "mock:artist:bonobo",
    name: "Bonobo",
    type: "artist",
    popularity: 0.75,
    mock: true,
    tags: [{ name: "electronic" }, { name: "downtempo" }],
  },
  "noma": {
    id: "mock:place:noma",
    name: "Noma",
    type: "place",
    subtype: "restaurant",
    popularity: 0.86,
    mock: true,
    tags: [{ name: "nordic" }, { name: "tasting-menu" }],
  },
  "state-bird": {
    id: "mock:place:state-bird",
    name: "State Bird Provisions",
    type: "place",
    popularity: 0.81,
    mock: true,
    tags: [{ name: "california" }, { name: "small-plates" }],
  },
  "porto": {
    id: "mock:destination:porto",
    name: "Porto",
    type: "destination",
    popularity: 0.8,
    mock: true,
    tags: [{ name: "walkable" }, { name: "wine" }],
  },
  "copenhagen": {
    id: "mock:destination:copenhagen",
    name: "Copenhagen",
    type: "destination",
    popularity: 0.84,
    mock: true,
    tags: [{ name: "design" }, { name: "food" }],
  },
  "slow-horses-rec": {
    id: "mock:tv_show:slow-horses",
    name: "Slow Horses",
    type: "tv_show",
    popularity: 0.83,
    mock: true,
    tags: [{ name: "spy" }, { name: "witty" }],
  },
  "andor": {
    id: "mock:tv_show:andor",
    name: "Andor",
    type: "tv_show",
    popularity: 0.86,
    mock: true,
    tags: [{ name: "sci-fi" }, { name: "prestige" }],
  },
  "leica": {
    id: "mock:brand:leica",
    name: "Leica",
    type: "brand",
    popularity: 0.7,
    mock: true,
    tags: [{ name: "photography" }],
  },
  "patagonia": {
    id: "mock:brand:patagonia",
    name: "Patagonia",
    type: "brand",
    popularity: 0.78,
    mock: true,
    tags: [{ name: "outdoor" }],
  },
};

const SEARCH_INDEX: Array<{ needles: string[]; entityKey: string }> = [
  { needles: ["past lives"], entityKey: "past-lives" },
  { needles: ["dune"], entityKey: "dune" },
  { needles: ["khruangbin"], entityKey: "khruangbin" },
  { needles: ["tame impala"], entityKey: "tame-impala" },
  { needles: ["chez panisse"], entityKey: "chez-panisse" },
  { needles: ["momofuku"], entityKey: "momofuku" },
  { needles: ["kyoto"], entityKey: "kyoto" },
  { needles: ["mexico city", "cdmx"], entityKey: "mexico-city" },
  { needles: ["severance"], entityKey: "severance" },
  { needles: ["the bear"], entityKey: "the-bear" },
  { needles: ["aesop"], entityKey: "aesop" },
  { needles: ["muji"], entityKey: "muji" },
  { needles: ["arrival"], entityKey: "arrival-rec" },
  { needles: ["porto"], entityKey: "porto" },
  { needles: ["copenhagen"], entityKey: "copenhagen" },
];

/** Mock /search — resolve a name to a fixture entity. */
export function mockSearch(
  query: string,
  type?: EntityType,
): QlooEntity[] {
  const q = query.toLowerCase().trim();
  const hits: QlooEntity[] = [];
  for (const row of SEARCH_INDEX) {
    if (row.needles.some((n) => q.includes(n) || n.includes(q))) {
      const e = FIXTURES[row.entityKey];
      if (e && (!type || e.type === type)) hits.push({ ...e });
    }
  }
  if (hits.length === 0) {
    // Synthetic fallback so the agent loop still advances in demo mode
    const fallbackType: EntityType = type ?? "brand";
    hits.push({
      id: `mock:${fallbackType}:${slug(query)}`,
      name: query,
      type: fallbackType,
      popularity: 0.5,
      mock: true,
      tags: [{ name: "demo-fixture" }],
    });
  }
  return hits;
}

/** Mock /v2/insights — cross-domain recommendations from seed entity IDs. */
export function mockInsights(
  filterType: EntityType,
  seedIds: string[],
  take = 3,
): QlooEntity[] {
  const pool: Record<EntityType, string[]> = {
    movie: ["aftersun", "perfect-days", "arrival-rec", "past-lives", "dune"],
    artist: ["floating-points", "bonobo", "khruangbin", "tame-impala"],
    place: ["state-bird", "noma", "chez-panisse", "momofuku"],
    destination: ["porto", "copenhagen", "kyoto", "mexico-city"],
    tv_show: ["slow-horses-rec", "andor", "severance", "the-bear"],
    brand: ["aesop", "leica", "muji", "patagonia"],
    book: [],
    person: [],
    podcast: [],
    video_game: [],
  };

  const seedSet = new Set(seedIds);
  const keys = pool[filterType] ?? [];
  const out: QlooEntity[] = [];
  for (const key of keys) {
    const e = FIXTURES[key];
    if (!e) continue;
    if (seedSet.has(e.id)) continue;
    out.push({ ...e });
    if (out.length >= take) break;
  }
  // If pool empty for type, invent labeled fixtures
  while (out.length < Math.min(take, 2)) {
    out.push({
      id: `mock:${filterType}:affinity-${out.length + 1}`,
      name: `Affinity ${filterType.replace("_", " ")} #${out.length + 1}`,
      type: filterType,
      popularity: 0.55,
      mock: true,
      tags: [{ name: "demo-fixture" }],
    });
  }
  return out;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function mockBanner(): string {
  return "MOCK / DEMO MODE — QLOO_API_KEY not set. All entities below are labeled fixtures, not live Qloo data.";
}
