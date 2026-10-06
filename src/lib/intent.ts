import type { Domain, EntityType, IntentExtraction, PlanKind } from "./types";
import { HOUSEHOLD } from "./household";

/**
 * Deterministic intent extractor (no external LLM required for MVP).
 * Maps vague plans → domains + seed queries from Avery & Morgan's profile.
 */
export function extractIntent(rawInput: string): IntentExtraction {
  const raw = rawInput.trim() || "Friday night in";
  const lower = raw.toLowerCase();

  let kind: PlanKind = "custom";
  let domains: Domain[] = [];
  let tone: IntentExtraction["tone"] = "cozy";
  let forWhom: IntentExtraction["forWhom"] = ["both"];
  const constraints: string[] = [];

  if (/gift/.test(lower)) {
    kind = "gift";
    domains = ["gift"];
    tone = "festive";
    if (/morgan/.test(lower)) forWhom = ["morgan"];
    else if (/avery/.test(lower)) forWhom = ["avery"];
    constraints.push("Keep it under one thoughtful item + a note");
  } else if (/weekend|trip|getaway|travel|fly|drive/.test(lower)) {
    kind = "weekend_trip";
    domains = ["travel", "dining", "music"];
    tone = "adventurous";
    constraints.push("Prefer walkable destinations");
    constraints.push("One quiet night + one exploratory day");
  } else if (/date/.test(lower)) {
    kind = "date_night";
    domains = ["dining", "film", "music"];
    tone = "quiet";
    constraints.push("Escalate only if Avery/Morgan tastes conflict");
  } else if (/friday|night in|cozy|stay.?in|movie night/.test(lower)) {
    kind = "friday_night_in";
    domains = ["dining", "film", "music", "tv"];
    tone = "cozy";
    constraints.push("Home-friendly: takeout or simple cook + stream + playlist");
  } else {
    kind = "custom";
    domains = ["dining", "film", "music", "travel"];
    tone = "quiet";
  }

  // Resolve which household seeds to pull
  const members = HOUSEHOLD.filter(
    (m) => forWhom.includes("both") || forWhom.includes(m.id),
  );

  const seedQueries: Array<{ query: string; type: EntityType }> = [];
  const pushSeed = (type: EntityType, domainNeeded: Domain | "any") => {
    if (domainNeeded !== "any" && !domains.includes(domainNeeded) && domainNeeded !== "gift") {
      // still allow seed resolution for cross-domain signals
    }
    for (const m of members) {
      const list = m.seeds[type] ?? [];
      for (const name of list.slice(0, 2)) {
        if (!seedQueries.some((s) => s.query === name && s.type === type)) {
          seedQueries.push({ query: name, type });
        }
      }
    }
  };

  // Always seed from movies/artists/places that ground taste across domains
  pushSeed("movie", "film");
  pushSeed("artist", "music");
  pushSeed("place", "dining");
  pushSeed("tv_show", "tv");
  if (domains.includes("travel")) pushSeed("destination", "travel");
  if (domains.includes("gift")) pushSeed("brand", "gift");

  // Cap seeds so Insights signals stay focused
  const capped = seedQueries.slice(0, 8);

  return {
    kind,
    raw,
    domains,
    seedQueries: capped,
    constraints,
    forWhom,
    tone,
  };
}

/** Generic LLM-only guesses — deliberately bland, to contrast with Qloo. */
export function llmOnlyGuesses(intent: IntentExtraction) {
  const catalog: Record<
    string,
    Array<{ name: string; domain: Domain; why: string; type: EntityType }>
  > = {
    friday_night_in: [
      {
        name: "Random Netflix Top 10 pick",
        domain: "film",
        why: "It's trending — no taste signal used.",
        type: "movie",
      },
      {
        name: "Generic 'chill vibes' Spotify playlist",
        domain: "music",
        why: "Keyword match on 'chill', not your artists.",
        type: "artist",
      },
      {
        name: "Whatever pizza place has 4.5★ nearby",
        domain: "dining",
        why: "Rating ≠ household affinity.",
        type: "place",
      },
      {
        name: "A prestige TV show everyone is talking about",
        domain: "tv",
        why: "Popularity heuristic only.",
        type: "tv_show",
      },
    ],
    weekend_trip: [
      {
        name: "Paris (always Paris)",
        domain: "travel",
        why: "Default romantic city for LLMs.",
        type: "destination",
      },
      {
        name: "A Michelin-starred spot from a blog list",
        domain: "dining",
        why: "Not grounded in Avery/Morgan seeds.",
        type: "place",
      },
      {
        name: "Airport lounge playlist",
        domain: "music",
        why: "Generic travel mood.",
        type: "artist",
      },
    ],
    gift: [
      {
        name: "A scented candle",
        domain: "gift",
        why: "Safe, forgettable default gift.",
        type: "brand",
      },
      {
        name: "Gift card to a big-box retailer",
        domain: "gift",
        why: "No cultural overlap computed.",
        type: "brand",
      },
    ],
    date_night: [
      {
        name: "Italian restaurant downtown",
        domain: "dining",
        why: "Stereotype date-night cuisine.",
        type: "place",
      },
      {
        name: "Whatever is in theaters",
        domain: "film",
        why: "No seed affinity.",
        type: "movie",
      },
      {
        name: "Top 40 dinner playlist",
        domain: "music",
        why: "Ignores household artists.",
        type: "artist",
      },
    ],
    custom: [
      {
        name: "A popular recommendation from training data",
        domain: "film",
        why: "Hallucinated popularity, not taste graph.",
        type: "movie",
      },
      {
        name: "A well-known city",
        domain: "travel",
        why: "No destination affinity from seeds.",
        type: "destination",
      },
    ],
  };

  return catalog[intent.kind] ?? catalog.custom;
}
