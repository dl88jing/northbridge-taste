# Northbridge Taste Concierge

**Household agent for Avery & Morgan** — turns a vague plan (*“Friday night in”*, *“weekend trip”*, *“gift for Morgan”*) into a short, **taste-grounded itinerary** across dining (`place`/`brand`), film/TV, music (`artist`), and travel (`destination`).

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/) (*Agents, but with taste*).

**Live demo:** [https://northbridge-taste.vercel.app](https://northbridge-taste.vercel.app) — currently in labeled **mock mode** until `QLOO_API_KEY` is set (`/api/health` reports `mode: "mock"`).

> **Win rule:** if it would work the same without Qloo, you’re building the wrong thing.  
> This app shows **Qloo-grounded** vs **LLM-only guess** side-by-side so the difference is obvious.

## Why Qloo matters here

A generic LLM can invent a cozy Friday night. It cannot reliably know that Avery’s affinity for *Past Lives* + *Khruangbin* + *Chez Panisse* and Morgan’s for *Dune* + *Severance* + *Mexico City* should pull **cross-domain** recommendations from a real taste graph.

Without Qloo:

- Seeds never resolve to entity IDs
- Cross-domain Insights never run
- The left column collapses; only the bland “LLM-only” column remains

With Qloo:

1. **Intent** — parse the vague plan + household profile  
2. **`GET /search`** — resolve seed names → entity IDs  
3. **`GET /v2/insights`** — `signal.interests.entities` → recommendations per domain  
4. **Policy gate** — quiet brief by default; escalate only when Avery/Morgan choices conflict  

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind — Vercel-ready  
- **Qloo Hackathon API** — `https://hackathon.api.qloo.com`  
- **Mock / demo mode** when `QLOO_API_KEY` is missing (labeled fixtures)

## Quick start

```bash
git clone https://github.com/dl88jing/northbridge-taste.git
cd northbridge-taste
npm install
cp .env.example .env.local
# Optional until your key arrives — app runs in mock mode without it
# echo 'QLOO_API_KEY=your_key_here' >> .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

| Variable | Required | Description |
|---|---|---|
| `QLOO_API_KEY` | for live mode | Hackathon key (header `X-Api-Key`) |
| `QLOO_BASE_URL` | no | Default `https://hackathon.api.qloo.com` |

**Important:** Hackathon keys work **only** against `https://hackathon.api.qloo.com`. They will 401 on staging/production.

Request a key via the [Qloo hackathon developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key).

### Health check

```bash
curl -s http://localhost:3000/api/health | jq
```

Returns `{ mode: "mock" | "live", qlooKeyPresent, qlooBase }`.

## Architecture

```
User plan ──► /api/plan
                │
                ├─ extractIntent()     # domains, seeds, tone, forWhom
                ├─ Qloo GET /search    # resolve Avery & Morgan seed names
                ├─ Qloo GET /v2/insights   # per-domain filter.type + signal.interests.entities
                ├─ policyGate()        # quiet brief; escalate on conflict
                └─ llmOnlyGuesses()    # deliberate contrast column
```

### Entity types used

Supported Insights `filter.type` values (URN form):  
`artist`, `book`, `brand`, `destination`, `movie`, `person`, `place`, `podcast`, `tv_show`, `video_game`.

This MVP focuses on **place, movie, tv_show, artist, destination, brand**.

### Endpoints we use (and do not)

| Use | Path |
|---|---|
| ✅ Search | `GET /search` |
| ✅ Insights | `GET /v2/insights` |
| ❌ Legacy | `/recs`, `/recommendations` |

## Deploy (Vercel)

Production: [https://northbridge-taste.vercel.app](https://northbridge-taste.vercel.app) (project `dylan-team/northbridge-taste`).

1. Import `dl88jing/northbridge-taste` in Vercel (or `vercel link --scope dylan-team`)  
2. Set env `QLOO_BASE_URL=https://hackathon.api.qloo.com` (optional until key arrives; leave `QLOO_API_KEY` unset for mock mode)  
3. Deploy — mock mode works even before the key lands  

```bash
npx vercel --prod --scope dylan-team
```

## Mock mode

If `QLOO_API_KEY` is empty, every Qloo call is served from **labeled fixtures** in `src/lib/mock-data.ts`. The UI badges steps and entities with **mock** so judges never confuse fixtures with live taste-graph data.

## License

MIT — see [LICENSE](./LICENSE).

## Submission notes

See [brief.md](./brief.md) for the hackathon submission checklist.
