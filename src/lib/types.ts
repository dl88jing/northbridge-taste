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

export type Domain =
  | "dining"
  | "film"
  | "tv"
  | "music"
  | "travel"
  | "gift";

export type PlanKind =
  | "friday_night_in"
  | "weekend_trip"
  | "gift"
  | "date_night"
  | "custom";

export interface HouseholdMember {
  id: "avery" | "morgan";
  name: "Avery" | "Morgan";
  /** Seed likes expressed as free-text names; resolved via Qloo /search */
  seeds: Partial<Record<EntityType, string[]>>;
  notes: string;
}

export interface QlooEntity {
  id: string;
  name: string;
  type: EntityType;
  subtype?: string;
  popularity?: number;
  properties?: Record<string, unknown>;
  tags?: Array<{ name?: string; id?: string }>;
  /** True when this came from mock fixtures, not live Qloo */
  mock?: boolean;
}

export interface IntentExtraction {
  kind: PlanKind;
  raw: string;
  domains: Domain[];
  /** Free-text seed phrases to resolve via /search */
  seedQueries: Array<{ query: string; type: EntityType }>;
  constraints: string[];
  forWhom: Array<"avery" | "morgan" | "both">;
  tone: "quiet" | "festive" | "adventurous" | "cozy";
}

export interface AgentStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail?: string;
  mock?: boolean;
}

export interface RecommendationCard {
  domain: Domain;
  entity: QlooEntity;
  why: string;
  source: "qloo" | "llm_guess" | "mock";
}

export interface QuietBrief {
  title: string;
  summary: string;
  itinerary: RecommendationCard[];
  escalations: string[];
  policyNotes: string[];
}

export interface PlanResult {
  mode: "live" | "mock";
  intent: IntentExtraction;
  steps: AgentStep[];
  resolvedSeeds: QlooEntity[];
  qlooBrief: QuietBrief;
  llmOnlyBrief: QuietBrief;
  comparisonNote: string;
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

export const URN_TO_TYPE: Record<string, EntityType> = Object.fromEntries(
  Object.entries(ENTITY_URN).map(([k, v]) => [v, k as EntityType]),
) as Record<string, EntityType>;
