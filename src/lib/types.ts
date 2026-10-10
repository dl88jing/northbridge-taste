/** Shared types for Northbridge Taste Concierge */

export type EntityType =
  | "artist"
  | "book"
  | "brand"
  | "destination"
  | "movie"
  | "person"
  | "place"
  | "podcast"
  | "tv_show"
  | "video_game";

export type MemberId = "avery" | "morgan";

export type PlanKind =
  | "friday_night_in"
  | "movie_night"
  | "date_night"
  | "weekend_trip"
  | "gift"
  | "custom";

export type Seeds = Partial<Record<EntityType, string[]>>;

export interface HouseholdMember {
  id: MemberId;
  name: "Avery" | "Morgan";
  /** Seed likes expressed as free-text names; resolved live via Qloo /search */
  seeds: Seeds;
  notes: string;
}

export interface QlooTag {
  id: string;
  name: string;
  type?: string;
}

export interface QlooEntity {
  id: string;
  name: string;
  type: EntityType;
  disambiguation?: string;
  popularity?: number;
  /** query.affinity from /v2/insights (0–1) */
  affinity?: number;
  image?: string;
  description?: string;
  year?: number;
  address?: string;
  neighborhood?: string;
  city?: string;
  website?: string;
  priceLevel?: number;
  rating?: number;
  lat?: number;
  lon?: number;
  googlePlaceId?: string;
  imdbId?: string;
  letterboxdId?: string;
  genres?: string[];
  tags: QlooTag[];
}

export interface DeepLink {
  label: string;
  href: string;
  kind: "map" | "book" | "watch" | "listen" | "tickets" | "web" | "shop" | "info";
}

/** One candidate with per-member fit (affinity from a scoring /v2/insights call). */
export interface ScoredCandidate {
  entity: QlooEntity;
  fit: Partial<Record<MemberId, number>>;
  /** Which per-member / joint lists the candidate appeared in */
  inLists: Array<MemberId | "joint">;
  sharedTags: string[];
  links: DeepLink[];
}

export interface SlotResult {
  id: string;
  label: string;
  verb: string;
  type: EntityType;
  /** Human-readable query description, e.g. "Japanese restaurant · San Francisco" */
  context: string;
  pick: ScoredCandidate | null;
  alternates: ScoredCandidate[];
  conflict: null | {
    severity: number;
    overlap: number;
    averyPick: ScoredCandidate;
    morganPick: ScoredCandidate;
    bridge: ScoredCandidate;
    escalated: boolean;
  };
  llm: {
    name: string;
    why: string;
    resolved: ScoredCandidate | null;
  } | null;
  chainedFrom?: string;
  error?: string;
}

export interface AgentStep {
  id: string;
  label: string;
  status: "done" | "error" | "skipped";
  detail: string;
  calls: number;
  ms: number;
}

export interface QlooCallLog {
  endpoint: "/search" | "/v2/insights" | "/v2/tags";
  purpose: string;
  params: Record<string, string>;
  status: number | "cache";
  results: number;
  ms: number;
}

export interface PlanRequest {
  plan: string;
  city?: string;
  cuisine?: string;
  household?: Partial<Record<MemberId, Seeds>>;
}

export interface PlanResult {
  ok: true;
  mode: "live";
  plan: string;
  kind: PlanKind;
  kindLabel: string;
  forWhom: MemberId[];
  city: string;
  cuisineTag?: QlooTag | null;
  seeds: Record<MemberId, QlooEntity[]>;
  unresolvedSeeds: string[];
  slots: SlotResult[];
  brief: {
    title: string;
    lines: string[];
    policy: string[];
    escalation: string | null;
  };
  contrast: {
    qlooAvgFit: number | null;
    llmAvgFit: number | null;
    qlooGrounded: number;
    llmGrounded: number;
    llmTotal: number;
    headline: string;
  };
  steps: AgentStep[];
  calls: QlooCallLog[];
  elapsedMs: number;
  cached?: boolean;
}

export const ENTITY_URN: Record<EntityType, string> = {
  artist: "urn:entity:artist",
  book: "urn:entity:book",
  brand: "urn:entity:brand",
  destination: "urn:entity:destination",
  movie: "urn:entity:movie",
  person: "urn:entity:person",
  place: "urn:entity:place",
  podcast: "urn:entity:podcast",
  tv_show: "urn:entity:tv_show",
  video_game: "urn:entity:video_game",
};
