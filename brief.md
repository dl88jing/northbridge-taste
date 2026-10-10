# Northbridge Taste Concierge: submission brief

**Public identity:** Northbridge / Avery & Morgan only.
**Live demo:** https://northbridge-taste.vercel.app (live Qloo data; `/api/health` → `mode: "live"`)
**Repo:** https://github.com/dl88jing/northbridge-taste (MIT)
**Hackathon:** [Qloo Agentic Hackathon](https://qloo.devpost.com/). Deadline Oct 30, 2026, 11:45 PM EDT.

## One-liner

A household agent for two people with different tastes: it turns vague plans into quiet, bookable briefs that fit both partners, asks one question only when their tastes really collide, and grades the generic LLM answer with the same Qloo taste graph.

## Submission checklist (Devpost)

| # | Requirement | Status |
|---|---|---|
| 1 | Functional demo, hosted externally | ✅ https://northbridge-taste.vercel.app (Vercel, live mode) |
| 2 | Public repo with all code + run instructions | ✅ github.com/dl88jing/northbridge-taste, README "Run it locally" |
| 3 | Text description of what makes it Qloo-powered | ✅ Devpost copy below + README table |
| 4 | Open-source license visible in GitHub About | ✅ MIT (`LICENSE`, detected by GitHub) |
| 5 | Demo video | Not required |

## 30-second judge path

1. Open the live URL and click **Friday night in**.
2. Read the dark banner: concierge picks vs LLM-only answers, **both scored by the same Qloo call**.
3. Look at the amber **One question** card. Avery's and Morgan's top films share 0 titles, so the agent proposes a bridge film with per-partner fit bars. Click *Avery's #1*: the brief updates.
4. Scroll: each row shows the Qloo pick (fit for Avery & Morgan, shared tags, deep links) next to the grey LLM-only answer.
5. Click **Date night out** to see chaining: drinks within 1.2 km of the chosen dinner. Or click **Weekend trip**: a destination both love, then a hotel and dinner there.

## Devpost description (paste-ready)

See the final section of this file.

## Judging alignment

| Criterion | How we hit it |
|---|---|
| Technological implementation | 5 Qloo calls per slot (3 lists + 2 per-partner scoring calls with `filter.results.entities`). Uses `/search`, `/v2/tags`, tag intersection and exclusion, geo `POINT` + radius chaining, destination → place chaining, plus rate-limit-aware retries and caching. Full request trace in the UI. |
| Design | A finished consumer flow: scenario cards, quiet brief, a single escalation card, swaps, an editable household, deep links, and copy-to-chat. No mock path. |
| Potential impact | Every couple, family or group chat negotiates taste. The same engine works for event promoters ("who will both partners actually buy tickets for?"), hospitality and gifting. The Ticketmaster "See live" links show the path to monetization. |
| Quality of idea | Multi-person taste reconciliation is something Qloo makes possible and an LLM alone can't do. The agent is designed to be *quiet*, and it scores its own LLM baseline. |

## Devpost description

### Northbridge Taste Concierge: an agent for two people who share a home, not a taste

**Try it:** https://northbridge-taste.vercel.app · **Code (MIT):** https://github.com/dl88jing/northbridge-taste

**The problem.** Most household plans are a negotiation. Avery loves *Past Lives*, Khruangbin and Chez Panisse. Morgan loves *Dune*, Radiohead and Momofuku. Ask a generic assistant for "a Friday night in" and you get *The Shawshank Redemption*, a chill playlist and the top-rated pizza place. That answer is popular, but it isn't grounded in either person's taste.

**What it does.** You give Northbridge a vague plan: *Friday night in*, *Date night out*, *Weekend trip*, *Gift for Morgan*, or anything else, optionally with a city or cuisine. In a few seconds it returns a short, bookable brief that fits both partners. It decides quietly and interrupts with **at most one question**, only when their tastes genuinely collide.

**How Qloo powers it (and why it breaks without Qloo):**
1. **Resolve tastes:** each partner's seed films, artists, restaurants, shows, destinations and brands become Qloo entity IDs via `/search`. Cuisines like "Japanese takeout" become real Qloo tag filters via `/v2/tags`.
2. **Three taste graphs per decision:** for each slot (dinner, film, playlist, hotel…), `/v2/insights` runs on Avery's signals, Morgan's signals, and the joint signal.
3. **Per-partner scoring:** a second `/v2/insights` call with `filter.results.entities` scores every candidate for each partner. The agent picks the **bridge**, the option with the best fit for the less-happy partner.
4. **Conflict detection and a quiet policy:** if Avery's and Morgan's top lists don't overlap on a primary slot and the gap is large, the agent asks one question (bridge vs Avery's #1 vs Morgan's #1). Otherwise it bridges silently and logs why.
5. **Chaining:** drinks are found within 1.2 km of the chosen dinner (`filter.location` POINT + radius). For a weekend trip, a destination both partners love feeds hotel and dinner searches *in that destination*. Tag intersection and exclusion keep "takeout restaurants" from turning into hotels or bars.
6. **Proof:** the generic LLM answer for each slot is resolved and scored **in the same Qloo call** as our candidates. The headline shows the gap; for example, our picks fit both partners at 88% vs 71% for the LLM-only answers. Some LLM answers ("a highly rated hotel downtown") can't be grounded at all.

Every pick comes with deep links (Maps, OpenTable, JustWatch, Spotify, Ticketmaster "See live", Bookshop, Google Hotels) and a "why" (per-partner fit and shared Qloo tags). The full Qloo request trace is one click away. The household's tastes are editable, and the next plan is re-grounded live.

Remove Qloo and nothing meaningful is left: no entities, no per-partner lists, no conflict detection, no bridge, no chained locations, no scores. Only the grey LLM column remains.

**Built with:** Next.js 16, TypeScript, Tailwind, Vercel, and the Qloo Hackathon API (`/search`, `/v2/insights`, `/v2/tags`). No mock data, and no Qloo data is stored in the repo; there is only a private server-side cache.

**What's next:** a shared household memory that learns from answered escalations, group mode (3+ people), and event discovery that matches an artist both partners love to upcoming shows.
