# Northbridge Taste Concierge — Submission brief

**Public identity:** Northbridge / Avery & Morgan only.  
**Repo (preferred):** https://github.com/dl88jing/northbridge-taste  
**Hackathon:** [Qloo Agentic Hackathon](https://qloo.devpost.com/) — deadline Oct 30, 2026 11:45pm EDT  

## One-liner

A household agent that turns vague plans into quiet, Qloo-grounded itineraries — and proves the point with a side-by-side LLM-only contrast.

## What makes it Qloo-powered

- Resolves Avery & Morgan’s seed tastes via **`GET /search`**
- Cross-domain recommendations via **`GET /v2/insights`** with `signal.interests.entities`
- If Qloo is removed (or key missing without mock), the grounded column has nothing real to show — the product clearly degrades
- Never uses legacy `/recs` or `/recommendations`

## Submission checklist (Devpost)

| # | Requirement | Status / notes |
|---|---|---|
| 1 | Functional demo app | Local works in mock mode; **live Vercel URL TBD** after first deploy |
| 2 | Public code repo | Push to `dl88jing/northbridge-taste` |
| 3 | Text description (Qloo-powered) | Use copy below |
| 4 | Externally hosted (Vercel) | Set `QLOO_API_KEY` in Vercel env when key arrives |
| 5 | OSS license visible in GitHub About | `LICENSE` (MIT) committed |

### Suggested Devpost description

> **Northbridge Taste Concierge** is a household agent for Avery & Morgan. You type a vague plan (“Friday night in”, “weekend trip”, “gift for Morgan”). The agent (1) extracts intent, (2) resolves seed entities with Qloo `/search`, (3) calls `/v2/insights` for cross-domain picks across dining, film/TV, music, and travel, then (4) policy-gates a quiet brief — escalating only when household tastes conflict. A side-by-side **LLM-only guess** column shows what you get without the taste graph: popular defaults with no cultural grounding. If Qloo were removed, the product would clearly degrade — which is the hackathon’s win rule.

## When the API key arrives

1. Put `QLOO_API_KEY=...` in `.env.local` (local) and Vercel project env (prod)  
2. Confirm `QLOO_BASE_URL=https://hackathon.api.qloo.com`  
3. `curl /api/health` → `mode: "live"`  
4. Re-run presets; mock badges should disappear  
5. Paste live Vercel URL into Devpost  

## Judging alignment

| Criterion | How we hit it |
|---|---|
| Technological Implementation | Real agent loop + `/search` + `/v2/insights`; mock path is explicit |
| Design | Complete concierge UX, quiet brief, contrast columns |
| Potential Impact | Household ops — real audience (shared taste decisions) |
| Quality of Idea | Policy-gated quiet agent + “prove Qloo matters” contrast |

## Out of scope for MVP (nice follow-ups)

- Streaming LLM narration of each step
- Map / booking deep links
- Persistent household memory store
- `/v2/tags` for cuisine/genre filters beyond entity seeds
