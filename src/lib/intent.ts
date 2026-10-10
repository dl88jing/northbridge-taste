import { HOME_CITY } from "./household";
import type { EntityType, MemberId, PlanKind } from "./types";

/**
 * Deterministic intent extraction (no external LLM). Maps a vague plan to a
 * plan kind, who it is for, location, optional cuisine, and the "slots" the
 * agent has to fill from the Qloo taste graph.
 */

export interface SlotSpec {
  id: string;
  label: string;
  verb: string;
  type: EntityType;
  /** Qloo tag IDs for filter.tags (resolved cuisine overrides `cuisineable` slots) */
  tags?: string[];
  excludeTags?: string[];
  cuisineable?: boolean;
  /** "home" = household city; "slot:<id>" = location of an earlier slot's pick */
  location?: "home" | `in:${string}` | `near:${string}`;
  /** Only the primary slots may trigger an escalation question */
  primary?: boolean;
  /** Keep only brands that are physical products (gift slots) */
  productOnly?: boolean;
  /** Representative generic answer an LLM-only assistant gives */
  llm: { name: string; why: string; type?: EntityType } | null;
}

export interface Intent {
  kind: PlanKind;
  kindLabel: string;
  raw: string;
  forWhom: MemberId[];
  city: string;
  destination?: string;
  cuisine?: string;
  forceEscalate: boolean;
  slots: SlotSpec[];
}

export const RESTAURANT = "urn:tag:category:place:restaurant";
const TAKEOUT = "urn:tag:service_options:place:takeout";
const COCKTAIL_BAR = "urn:tag:category:place:cocktail_bar";
const HOTEL = "urn:tag:category:place:hotel";
const NOT_A_RESTAURANT = [HOTEL, "urn:tag:genre:place:hotel", "urn:tag:category:place:bar", COCKTAIL_BAR];

const CUISINES = [
  "japanese", "sushi", "ramen", "mexican", "taco", "italian", "pizza", "thai",
  "korean", "chinese", "dim sum", "indian", "french", "vietnamese", "pho",
  "mediterranean", "greek", "spanish", "tapas", "ethiopian", "vegan",
  "vegetarian", "seafood", "burmese", "peruvian", "middle eastern", "bbq",
  "steakhouse", "burger", "brunch",
];

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractIntent(
  rawInput: string,
  opts: { city?: string; cuisine?: string } = {},
): Intent {
  const raw = rawInput.trim() || "Friday night in";
  const lower = raw.toLowerCase();

  let forWhom: MemberId[] = ["avery", "morgan"];
  const forceEscalate =
    /(can'?t|never|don'?t|won'?t) agree|disagree|settle|compromise|argu/.test(lower);

  // Location: explicit UI field > "in <City>" in the plan > home city
  const inMatch = raw.match(/\b(?:in|around|near)\s+([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2})/);
  const toMatch = raw.match(/\b(?:to)\s+([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2})/);
  let city = opts.city?.trim() || HOME_CITY;
  if (!opts.city?.trim() && inMatch && !/trip|weekend/.test(lower)) city = inMatch[1];

  const cuisine =
    opts.cuisine?.trim() ||
    CUISINES.find((c) => new RegExp(`\\b${c}`, "i").test(lower));

  let kind: PlanKind = "custom";
  if (/gift|present|birthday|anniversary/.test(lower)) kind = "gift";
  else if (/weekend|trip|getaway|travel|vacation|fly|road/.test(lower)) kind = "weekend_trip";
  else if (/date|dinner out|night out/.test(lower)) kind = "date_night";
  else if (/movie night|watch|film|show|series|binge/.test(lower)) kind = "movie_night";
  else if (/friday|night in|cozy|stay.?in|sunday|evening in|takeout/.test(lower)) kind = "friday_night_in";

  let slots: SlotSpec[] = [];
  let kindLabel = "Custom plan";
  let destination: string | undefined;

  switch (kind) {
    case "friday_night_in":
      kindLabel = "Night in";
      slots = [
        {
          id: "takeout", label: "Takeout", verb: "Order from", type: "place",
          tags: [TAKEOUT, RESTAURANT], excludeTags: NOT_A_RESTAURANT, cuisineable: true, location: "home", primary: false,
          llm: { name: "Tony's Pizza Napoletana", why: "“Top-rated pizza in SF” — a ratings-list default, not your tastes." },
        },
        {
          id: "film", label: "Film", verb: "Watch", type: "movie", primary: true,
          llm: { name: "The Shawshank Redemption", why: "The most-recommended movie on the internet. Safe, generic." },
        },
        {
          id: "music", label: "Playlist seed", verb: "Put on", type: "artist", primary: false,
          llm: { name: "Jack Johnson", why: "Keyword match on “chill night in”." },
        },
      ];
      break;
    case "movie_night":
      kindLabel = "Movie night";
      slots = [
        {
          id: "film", label: "Film", verb: "Watch", type: "movie", primary: true,
          llm: { name: "The Shawshank Redemption", why: "Top of every “best movies ever” list." },
        },
        {
          id: "series", label: "Series to start", verb: "Start", type: "tv_show", primary: true,
          llm: { name: "Friends", why: "Most-streamed comfort show — popularity, not taste." },
        },
      ];
      break;
    case "date_night":
      kindLabel = "Date night out";
      slots = [
        {
          id: "dinner", label: "Dinner", verb: "Eat at", type: "place",
          tags: [RESTAURANT], excludeTags: NOT_A_RESTAURANT, cuisineable: true, location: "home", primary: true,
          llm: { name: "Gary Danko", why: "Perennial “most romantic restaurant in SF” listicle pick." },
        },
        {
          id: "drinks", label: "Drinks after (walkable)", verb: "Then", type: "place",
          tags: [COCKTAIL_BAR], location: "near:dinner", primary: false,
          llm: { name: "Tonga Room & Hurricane Bar", why: "Famous tourist bar — not near dinner, not your vibe." },
        },
        {
          id: "music", label: "Soundtrack / see live", verb: "Listen to", type: "artist", primary: false,
          llm: { name: "John Legend", why: "Generic “romantic dinner” playlist artist." },
        },
      ];
      break;
    case "weekend_trip": {
      kindLabel = "Weekend trip";
      const dest = toMatch?.[1] ?? inMatch?.[1];
      destination = dest;
      slots = [
        ...(dest
          ? []
          : [{
              id: "destination", label: "Where", verb: "Go to", type: "destination" as EntityType, primary: true,
              llm: { name: "Napa Valley", why: "The default Bay Area weekend answer." },
            }]),
        {
          id: "stay", label: "Stay", verb: "Stay at", type: "place",
          tags: [HOTEL], location: dest ? (`in:${dest}` as const) : "near:destination", primary: false,
          llm: { name: "A highly rated hotel downtown", why: "Not a specific place — can't be grounded or booked." },
        },
        {
          id: "dinner", label: "Dinner there", verb: "Eat at", type: "place",
          tags: [RESTAURANT], excludeTags: NOT_A_RESTAURANT, cuisineable: true, location: dest ? (`in:${dest}` as const) : "near:destination", primary: false,
          llm: dest
            ? { name: `A “top 10 restaurants in ${titleCase(dest)}” pick`, why: "Generic listicle answer — no specific place, no taste signal." }
            : { name: "The French Laundry", why: "World-famous Napa name — an LLM's go-to, months-long waitlist." },
        },
        {
          id: "music", label: "Trip soundtrack", verb: "Soundtrack:", type: "artist", primary: false,
          llm: { name: "Fleetwood Mac", why: "Classic “road trip playlist” default." },
        },
      ];
      break;
    }
    case "gift": {
      if (/morgan/.test(lower) && !/avery/.test(lower)) forWhom = ["morgan"];
      else if (/avery/.test(lower) && !/morgan/.test(lower)) forWhom = ["avery"];
      kindLabel =
        forWhom.length === 1
          ? `Gift for ${forWhom[0] === "avery" ? "Avery" : "Morgan"}`
          : "Gift for both of us";
      slots = [
        {
          id: "object", label: "Something to unwrap", verb: "Gift", type: "brand",
          productOnly: true, primary: true,
          llm: { name: "Yankee Candle", why: "The universal safe gift. Forgettable." },
        },
        {
          id: "book", label: "Something to read", verb: "Add", type: "book", primary: false,
          llm: { name: "Atomic Habits", why: "Bestseller list #1 — popularity, not taste." },
        },
        {
          id: "experience", label: "An experience (tickets)", verb: "Plus tickets to see", type: "artist", primary: false,
          llm: { name: "Taylor Swift", why: "Biggest tour in the world; no signal it fits." },
        },
      ];
      break;
    }
    default:
      kindLabel = "Custom plan";
      slots = [
        {
          id: "dinner", label: "Dinner", verb: "Eat at", type: "place",
          tags: [RESTAURANT], excludeTags: NOT_A_RESTAURANT, cuisineable: true, location: "home", primary: true,
          llm: { name: "Gary Danko", why: "Listicle default." },
        },
        {
          id: "film", label: "Film", verb: "Watch", type: "movie", primary: true,
          llm: { name: "The Shawshank Redemption", why: "The internet's default answer." },
        },
        {
          id: "music", label: "Music", verb: "Listen to", type: "artist", primary: false,
          llm: { name: "Coldplay", why: "Popularity default." },
        },
      ];
  }

  // Named LLM-only place answers are San Francisco listicle defaults; elsewhere
  // a generic assistant answers with an unbookable category, so say that.
  const finalCity = titleCase(city);
  if (finalCity.toLowerCase() !== HOME_CITY.toLowerCase()) {
    for (const s of slots) {
      if (s.type === "place" && s.location !== undefined && !s.location.startsWith("in:") && s.llm) {
        s.llm = {
          name: `A “best of ${finalCity}” listicle ${s.id === "drinks" ? "bar" : "restaurant"}`,
          why: "Generic category answer — not a specific, bookable place, no taste signal.",
        };
      }
    }
  }

  return {
    kind,
    kindLabel,
    raw,
    forWhom,
    city: finalCity,
    destination,
    cuisine: cuisine ? cuisine.toLowerCase() : undefined,
    forceEscalate,
    slots,
  };
}
