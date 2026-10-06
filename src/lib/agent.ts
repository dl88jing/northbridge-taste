import { extractIntent, llmOnlyGuesses } from "./intent";
import { getInsights, qlooMode, searchEntities } from "./qloo";
import { mockBanner } from "./mock-data";
import type {
  AgentStep,
  Domain,
  EntityType,
  PlanResult,
  QuietBrief,
  RecommendationCard,
  QlooEntity,
} from "./types";

const DOMAIN_TO_FILTER: Partial<Record<Domain, EntityType>> = {
  dining: "place",
  film: "movie",
  tv: "tv_show",
  music: "artist",
  travel: "destination",
  gift: "brand",
};

/**
 * Northbridge Taste Concierge agent loop:
 * 1) extract intent
 * 2) resolve seed entities via Qloo /search
 * 3) call /v2/insights for cross-domain recommendations
 * 4) policy-gate into a quiet brief (escalate only on conflict)
 */
export async function runTasteAgent(rawPlan: string): Promise<PlanResult> {
  const mode = qlooMode();
  const steps: AgentStep[] = [
    { id: "intent", label: "Extract intent", status: "running" },
    { id: "search", label: "Resolve seeds via Qloo /search", status: "pending" },
    { id: "insights", label: "Cross-domain /v2/insights", status: "pending" },
    { id: "policy", label: "Policy-gate quiet brief", status: "pending" },
    { id: "compare", label: "Build LLM-only contrast", status: "pending" },
  ];

  const intent = extractIntent(rawPlan);
  steps[0] = {
    ...steps[0],
    status: "done",
    detail: `${intent.kind} · domains [${intent.domains.join(", ")}] · tone ${intent.tone}`,
    mock: mode === "mock",
  };

  // Step 2 — resolve seeds
  steps[1] = { ...steps[1], status: "running", mock: mode === "mock" };
  const resolvedSeeds: QlooEntity[] = [];
  const searchNotes: string[] = [];
  for (const seed of intent.seedQueries) {
    try {
      const hits = await searchEntities(seed.query, seed.type, 3);
      if (hits[0]) {
        resolvedSeeds.push(hits[0]);
        searchNotes.push(`${seed.query} → ${hits[0].name}`);
      }
    } catch (err) {
      searchNotes.push(
        `${seed.query} failed: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }
  steps[1] = {
    ...steps[1],
    status: resolvedSeeds.length ? "done" : "error",
    detail: searchNotes.slice(0, 6).join("; ") || "No seeds resolved",
    mock: mode === "mock",
  };

  const signalIds = resolvedSeeds.map((e) => e.id);

  // Step 3 — insights per domain
  steps[2] = { ...steps[2], status: "running", mock: mode === "mock" };
  const insightCards: RecommendationCard[] = [];
  const insightNotes: string[] = [];

  const targetDomains = intent.domains.filter((d) => DOMAIN_TO_FILTER[d]);
  // Ensure we always cover at least dining + film + music when "friday night"
  const domainsToQuery =
    targetDomains.length > 0
      ? targetDomains
      : (["dining", "film", "music"] as Domain[]);

  for (const domain of domainsToQuery) {
    const filterType = DOMAIN_TO_FILTER[domain];
    if (!filterType) continue;
    try {
      const entities = await getInsights({
        filterType,
        signalEntityIds: signalIds,
        take: 3,
      });
      const top = entities[0];
      if (top) {
        insightCards.push({
          domain,
          entity: top,
          why: whyFromSeeds(top, resolvedSeeds, domain),
          source: mode === "mock" ? "mock" : "qloo",
        });
        insightNotes.push(
          `${domain}: ${top.name}${top.mock ? " [fixture]" : ""}`,
        );
      }
    } catch (err) {
      insightNotes.push(
        `${domain} insights error: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }

  steps[2] = {
    ...steps[2],
    status: insightCards.length ? "done" : "error",
    detail: insightNotes.join("; ") || "No insights",
    mock: mode === "mock",
  };

  // Step 4 — policy gate
  steps[3] = { ...steps[3], status: "running" };
  const { brief, escalations, policyNotes } = policyGate(
    intent.raw,
    intent.tone,
    insightCards,
    resolvedSeeds,
  );
  steps[3] = {
    ...steps[3],
    status: "done",
    detail:
      escalations.length === 0
        ? "Quiet brief OK — no conflicts"
        : `Escalated: ${escalations.join("; ")}`,
  };

  // Step 5 — LLM-only contrast
  steps[4] = { ...steps[4], status: "running" };
  const llmCards: RecommendationCard[] = llmOnlyGuesses(intent).map((g) => ({
    domain: g.domain,
    entity: {
      id: `llm:${g.type}:${g.name}`,
      name: g.name,
      type: g.type,
      mock: false,
    },
    why: g.why,
    source: "llm_guess" as const,
  }));
  const llmBrief: QuietBrief = {
    title: "LLM-only guess (no taste graph)",
    summary:
      "What a generic assistant invents from keywords and popularity — culturally blind.",
    itinerary: llmCards,
    escalations: [],
    policyNotes: ["No Qloo signals used."],
  };
  steps[4] = {
    ...steps[4],
    status: "done",
    detail: `${llmCards.length} generic guesses for side-by-side contrast`,
  };

  const qlooBrief: QuietBrief = {
    title:
      mode === "mock"
        ? "Qloo-grounded brief (MOCK fixtures)"
        : "Qloo-grounded brief",
    summary: brief,
    itinerary: insightCards,
    escalations,
    policyNotes,
  };

  return {
    mode,
    intent,
    steps,
    resolvedSeeds,
    qlooBrief,
    llmOnlyBrief: llmBrief,
    comparisonNote:
      mode === "mock"
        ? `${mockBanner()} Side-by-side still proves the win rule: without the taste graph, the agent collapses to generic guesses.`
        : "If Qloo were removed, the right column would be all you get — popular defaults with no household affinity. Cultural intelligence is the differentiator.",
  };
}

function whyFromSeeds(
  entity: QlooEntity,
  seeds: QlooEntity[],
  domain: Domain,
): string {
  const seedNames = seeds
    .slice(0, 3)
    .map((s) => s.name)
    .join(", ");
  const tag =
    entity.tags
      ?.map((t) => t.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") || domain;
  const fixture = entity.mock ? " [fixture data]" : "";
  return `Affinity via Qloo taste graph from seeds (${seedNames || "household profile"}) → ${tag}.${fixture}`;
}

function policyGate(
  raw: string,
  tone: string,
  cards: RecommendationCard[],
  seeds: QlooEntity[],
): { brief: string; escalations: string[]; policyNotes: string[] } {
  const escalations: string[] = [];
  const policyNotes: string[] = [
    "Default: quiet brief — short itinerary, no chatter.",
    "Escalate only when Avery vs Morgan affinities conflict on the same domain.",
  ];

  // Heuristic conflict: if dining place tags include both "loud" vibes somehow — keep simple
  const movie = cards.find((c) => c.domain === "film" || c.domain === "tv");
  const music = cards.find((c) => c.domain === "music");
  const dining = cards.find((c) => c.domain === "dining");

  // Detect soft conflict: sci-fi heavy Morgan seed vs quiet Avery film when both present
  const hasQuietSeed = seeds.some((s) =>
    /past lives|khruangbin|kyoto|chez|muji|norah/i.test(s.name),
  );
  const hasBoldSeed = seeds.some((s) =>
    /dune|tame impala|severance|momofuku|mexico|beyoncé/i.test(s.name),
  );
  if (hasQuietSeed && hasBoldSeed && tone === "cozy") {
    policyNotes.push(
      "Mixed household signals detected — prefer quieter option for Friday-in; bold option noted as alternate.",
    );
  }
  if (hasQuietSeed && hasBoldSeed && /gift.*both|both.*gift/i.test(raw)) {
    escalations.push(
      "Gift for both: Avery leans minimal/quiet, Morgan leans bold/story — confirm budget + story preference.",
    );
  }

  const parts: string[] = [];
  parts.push(`Plan: “${raw}”.`);
  if (dining) parts.push(`Eat: ${dining.entity.name}.`);
  if (movie) parts.push(`Watch: ${movie.entity.name}.`);
  if (music) parts.push(`Listen: ${music.entity.name}.`);
  const travel = cards.find((c) => c.domain === "travel");
  if (travel) parts.push(`Go: ${travel.entity.name}.`);
  const gift = cards.find((c) => c.domain === "gift");
  if (gift) parts.push(`Gift: ${gift.entity.name}.`);
  if (cards.length === 0) {
    parts.push("No grounded picks yet — check API key or try another plan.");
  }

  return {
    brief: parts.join(" "),
    escalations,
    policyNotes,
  };
}
