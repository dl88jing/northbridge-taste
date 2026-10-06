import type { HouseholdMember } from "./types";

/** Avery & Morgan — Northbridge household taste profile (public demo identity). */
export const HOUSEHOLD: HouseholdMember[] = [
  {
    id: "avery",
    name: "Avery",
    notes:
      "Prefers quiet evenings, indie film, Japanese / seasonal cooking, jazz and ambient playlists. Avoids loud crowds.",
    seeds: {
      movie: ["Past Lives", "Before Sunrise", "The Grand Budapest Hotel"],
      artist: ["Khruangbin", "Norah Jones", "Miles Davis"],
      place: ["Chez Panisse", "Tartine Bakery"],
      brand: ["Muji", "Patagonia"],
      destination: ["Kyoto", "Lisbon"],
      tv_show: ["The Bear", "Slow Horses"],
    },
  },
  {
    id: "morgan",
    name: "Morgan",
    notes:
      "Curious traveler, sci-fi + prestige TV, bold flavors, live music when the vibe is right. Loves gift-giving with a story.",
    seeds: {
      movie: ["Dune", "Everything Everywhere All at Once", "Arrival"],
      artist: ["Tame Impala", "Beyoncé", "Radiohead"],
      place: ["Momofuku Noodle Bar", "Starbucks Reserve Roastery"],
      brand: ["Aesop", "Leica"],
      destination: ["Reykjavik", "Mexico City"],
      tv_show: ["Severance", "The Expanse"],
    },
  },
];

export function householdBlurb(): string {
  return HOUSEHOLD.map((m) => `${m.name}: ${m.notes}`).join(" ");
}
