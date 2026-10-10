import type { HouseholdMember, MemberId, Seeds } from "./types";

/** Avery & Morgan — the Northbridge household (public demo identity). */
export const HOUSEHOLD: HouseholdMember[] = [
  {
    id: "avery",
    name: "Avery",
    notes:
      "Quiet evenings, intimate indie film, seasonal Californian cooking, soft psych-soul and jazz. Avoids loud crowds.",
    seeds: {
      movie: ["Past Lives", "Before Sunrise"],
      artist: ["Khruangbin", "Norah Jones"],
      place: ["Chez Panisse", "Tartine Bakery"],
      tv_show: ["The Bear"],
      destination: ["Kyoto"],
      brand: ["Muji"],
    },
  },
  {
    id: "morgan",
    name: "Morgan",
    notes:
      "Cerebral sci-fi and prestige TV, bold flavors, art-rock and electronic. Curious traveler; loves gifts with a story.",
    seeds: {
      movie: ["Dune", "Arrival"],
      artist: ["Tame Impala", "Radiohead"],
      place: ["Momofuku Noodle Bar", "La Taqueria"],
      tv_show: ["Severance"],
      destination: ["Reykjavik"],
      brand: ["Leica"],
    },
  },
];

export const HOME_CITY = "San Francisco";

export function memberName(id: MemberId): "Avery" | "Morgan" {
  return id === "avery" ? "Avery" : "Morgan";
}

export function seedsFor(
  id: MemberId,
  overrides?: Partial<Record<MemberId, Seeds>>,
): Seeds {
  const o = overrides?.[id];
  if (o && Object.values(o).some((v) => v && v.length)) return o;
  return HOUSEHOLD.find((m) => m.id === id)!.seeds;
}
