import type { DeepLink, QlooEntity } from "./types";

const enc = encodeURIComponent;

/** Action links for a Qloo entity — maps, reservations, streaming, tickets. */
export function deepLinks(e: QlooEntity, opts: { lodging?: boolean } = {}): DeepLink[] {
  const links: DeepLink[] = [];
  switch (e.type) {
    case "place": {
      const q = [e.name, e.address].filter(Boolean).join(" ");
      links.push({
        label: "Map",
        kind: "map",
        href: e.googlePlaceId
          ? `https://www.google.com/maps/search/?api=1&query=${enc(q)}&query_place_id=${enc(e.googlePlaceId)}`
          : `https://www.google.com/maps/search/?api=1&query=${enc(q)}`,
      });
      if (opts.lodging) {
        links.push({
          label: "Check rates",
          kind: "book",
          href: `https://www.google.com/travel/search?q=${enc(q)}`,
        });
      } else {
        links.push({
          label: "Reserve",
          kind: "book",
          href: `https://www.opentable.com/s?term=${enc(e.name)}${e.city ? `&metroName=${enc(e.city)}` : ""}&covers=2`,
        });
      }
      if (e.website) links.push({ label: "Website", kind: "web", href: e.website });
      break;
    }
    case "movie":
    case "tv_show":
      links.push({
        label: "Where to stream",
        kind: "watch",
        href: `https://www.justwatch.com/us/search?q=${enc(e.name)}`,
      });
      if (e.imdbId)
        links.push({ label: "IMDb", kind: "info", href: `https://www.imdb.com/title/${e.imdbId}/` });
      if (e.letterboxdId && e.type === "movie")
        links.push({
          label: "Letterboxd",
          kind: "info",
          href: `https://letterboxd.com/film/${e.letterboxdId}/`,
        });
      break;
    case "artist":
      links.push({
        label: "Listen",
        kind: "listen",
        href: `https://open.spotify.com/search/${enc(e.name)}`,
      });
      links.push({
        label: "See live",
        kind: "tickets",
        href: `https://www.ticketmaster.com/search?q=${enc(e.name)}`,
      });
      break;
    case "destination":
      links.push({
        label: "Map",
        kind: "map",
        href: `https://www.google.com/maps/search/?api=1&query=${enc(e.name)}`,
      });
      links.push({
        label: "Stays",
        kind: "book",
        href: `https://www.google.com/travel/hotels/${enc(e.name)}`,
      });
      break;
    case "book":
      links.push({
        label: "Bookshop",
        kind: "shop",
        href: `https://bookshop.org/search?keywords=${enc(e.name)}`,
      });
      break;
    case "brand":
      if (e.website) links.push({ label: "Shop", kind: "shop", href: e.website });
      else
        links.push({
          label: "Shop",
          kind: "shop",
          href: `https://www.google.com/search?tbm=shop&q=${enc(e.name)}`,
        });
      break;
    default:
      links.push({
        label: "Look up",
        kind: "info",
        href: `https://www.google.com/search?q=${enc(e.name)}`,
      });
  }
  return links;
}
