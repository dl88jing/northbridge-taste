# Northbridge Taste Concierge

**A household agent for two people who share a home, not a taste.**
Avery & Morgan give it a vague plan — *"Friday night in"*, *"Date night out"*, *"Weekend trip"*, *"Gift for Morgan"* — and it returns a short, bookable brief that fits **both** of them. It decides quietly, and asks **one** question only when their tastes genuinely collide.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/) (*Agents, but with taste*).

**▶ Live demo: [northbridge-taste.vercel.app](https://northbridge-taste.vercel.app)**: live Qloo data, no login. Click any scenario card.
**🎬 Demo video (2:32): [demo.mp4 on the GitHub release](https://github.com/dl88jing/northbridge-taste/releases/download/demo-video-v1/demo.mp4)** ([release page](https://github.com/dl88jing/northbridge-taste/releases/tag/demo-video-v1)): live app, live Qloo API.

Health check: [`/api/health`](https://northbridge-taste.vercel.app/api/health) → `{"mode":"live", ...}`

---

## The 30-second version

1. **Each partner's tastes → Qloo entities.** Avery's and Morgan's favorite films, artists, restaurants, shows, places and brands are resolved live with `GET /search`.
2. **Per-partner + joint taste graph.** For every part of the plan, `GET /v2/insights` runs three times: Avery's signals, Morgan's signals, and both together.
3. **Score every candidate for each partner.** A second `/v2/insights` call with `filter.results.entities` gets each partner's affinity for every candidate. The pick is the **bridge**: the candidate with the best fit for the *less-happy* partner.
4. **Escalate at most once.** If Avery's and Morgan's top lists share nothing (overlap = 0) on a primary slot, and the gap is big enough, the agent asks a single question: *bridge, Avery's #1, or Morgan's #1?* Everything else is decided quietly and logged in the policy panel.
5. **Grade the LLM-only answer with the same graph.** The generic answer an assistant gives without a taste graph (*The Shawshank Redemption*, *Jack Johnson*, *Yankee Candle*, *Napa*) is resolved and scored **in the same call** as the concierge's candidates. The UI headline shows the gap. For example: *"the concierge's picks fit both partners at 88% vs 71% for the LLM-only answers."*

> **Win rule:** if it would work the same without Qloo, you built the wrong thing.
> Remove Qloo and nothing is left: no entities, no per-partner lists, no overlap or conflict detection, no bridge, no chained locations, no scores. Only the grey LLM column remains.

## What makes it Qloo-powered (non-trivial use)

| Capability | Qloo call(s) |
|---|---|
| Resolve each partner's seed tastes (up to 2 per type × 6 types × 2 people) | `GET /search?query=…&types=urn:entity:<type>` |
| Cuisine filter from natural language ("Japanese takeout", "thai") | `GET /v2/tags?filter.query=…` → `filter.tags=urn:tag:category:place:<cuisine>` |
| Per-partner and joint recommendations, per slot | `GET /v2/insights?filter.type=…&signal.interests.entities=<ids>` |
| Per-partner affinity for specific candidates (bridge + conflict severity + LLM grading) | `GET /v2/insights?…&filter.results.entities=<candidate ids>` |
| Restaurants that do takeout, and are actually restaurants | `filter.tags=takeout,restaurant` + `operator.filter.tags=intersection` + `filter.exclude.tags=hotel,bar` |
| Home-city or destination grounding | `filter.location.query=<city / chosen destination>` |
| **Chaining**: drinks within 1.2 km of the chosen dinner | `filter.location=POINT(lon lat)` + `filter.location.radius=1200` from the dinner pick's geocode |
| **Cross-domain chaining**: destination both love → hotel + dinner *there* | destination pick → `filter.location.query=<destination>` for `place` + hotel / restaurant tags |
| Gift for one partner (object, book, concert tickets) | `filter.type=brand / book / artist`, recipient's signals only, product-category tag filter for brands |

Entity types used: `movie`, `tv_show`, `artist`, `place`, `destination`, `brand`, `book`.
Never uses the legacy `/recs` or `/recommendations` endpoints.

Every Qloo request behind a plan is shown in the UI (**Agent trace → Show every Qloo request**): endpoint, purpose, key params, status, and result count.

## Product features

- **Six one-click scenarios:** night in (escalation), date night (geo chaining), weekend trip (cross-domain chaining), movie night (conflict), gift for Morgan (single-recipient), Japanese takeout (`/v2/tags`)
- **Free-text plans** plus optional **city** and **cuisine** fields (e.g. *"Weekend trip to Lisbon"*, *"Date night out"* + *New York* + *thai*)
- **Quiet brief:** numbered itinerary with deep links (Google Maps, OpenTable, JustWatch, IMDb/Letterboxd, Spotify, **Ticketmaster "See live"**, Bookshop, Google Hotels) and a *Copy for the group chat* button
- **Escalation card:** bridge vs Avery's #1 vs Morgan's #1, each with per-partner fit bars. Answering it updates the brief instantly.
- **Swap** any pick for one of the next-best candidates
- **Editable household:** add or remove each partner's tastes (saved in your browser). The next plan is re-grounded live.
- **"Why" on every pick:** per-partner fit, the Qloo tags it shares with that partner's seeds, and which lists it came from

## Run it locally

Requires Node 20+ and a Qloo hackathon API key ([how to get one](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key)).

```bash
git clone https://github.com/dl88jing/northbridge-taste.git
cd northbridge-taste
npm install
cp .env.example .env.local
# edit .env.local → QLOO_API_KEY=your_key
npm run dev
```

Open <http://localhost:3000> and check `curl -s localhost:3000/api/health`.

| Variable | Required | Description |
|---|---|---|
| `QLOO_API_KEY` | yes | Hackathon key (sent as the `X-Api-Key` header, server-side only) |
| `QLOO_BASE_URL` | no | Defaults to `https://hackathon.api.qloo.com` |

Hackathon keys work **only** against `https://hackathon.api.qloo.com`. Without a key, `/api/plan` returns a clear 503 and `/api/health` reports `mode: "unconfigured"`. There is no fake or mock data path.

### API

```bash
curl -s -X POST https://northbridge-taste.vercel.app/api/plan \
  -H 'content-type: application/json' \
  -d '{"plan":"Date night out","city":"San Francisco","cuisine":"thai"}' | jq '.brief, .contrast'
```

Optional `household` overrides each partner's seeds: `{"avery":{"movie":["Amelie"]},"morgan":{"artist":["Daft Punk"]}}`.

## Architecture

```
plan ─► POST /api/plan
          │
          ├─ extractIntent()            plan kind · who · city/destination · cuisine · slots
          ├─ GET /search                Avery & Morgan seeds → entity IDs   (parallel, cached 24h)
          ├─ GET /v2/tags               cuisine → urn:tag:category:place:*  (if any)
          ├─ per independent slot (parallel):
          │    GET /v2/insights ×3      Avery list · Morgan list · joint list
          │    GET /search              resolve the LLM-only answer
          │    GET /v2/insights ×2      score candidates + LLM answer for each partner (filter.results.entities)
          ├─ chained slots              near:dinner (POINT + radius) · in:<destination>
          ├─ policyGate()               bridge picks · escalate ≤ 1 conflict · policy log
          └─ contrast                   avg fit (less-happy partner): concierge vs LLM-only
```

- `src/lib/qloo.ts`: Qloo client: concurrency cap, 429-aware retry (reads `x-second-ratelimit-reset`), private server-side cache (in-memory + Next data cache). No Qloo response data is stored in this repo.
- `src/lib/intent.ts`: deterministic intent → slots (with the representative LLM-only answers)
- `src/lib/agent.ts`: the agent loop, bridge and conflict math, chaining, policy gate
- `src/lib/links.ts`: booking, map, stream and ticket deep links
- `src/components/ConciergeApp.tsx`: the UI

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 on Vercel. No LLM API is required. The "LLM-only" column holds representative static answers, labeled as such in the UI.

## Deploy (Vercel)

Production: <https://northbridge-taste.vercel.app> (`QLOO_API_KEY` set for all Vercel environments).

```bash
npx vercel link        # once
npx vercel env add QLOO_API_KEY
npx vercel --prod
```

## License

[MIT](./LICENSE)

See [brief.md](./brief.md) for the submission brief and Devpost copy.
