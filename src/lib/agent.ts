import { extractIntent, RESTAURANT, type Intent, type SlotSpec } from "./intent";
import { memberName, seedsFor } from "./household";
import { deepLinks } from "./links";
import {
  getInsights,
  searchEntities,
  searchTags,
  Tracer,
  type InsightsQuery,
} from "./qloo";
import type {
  AgentStep,
  EntityType,
  MemberId,
  PlanRequest,
  PlanResult,
  QlooEntity,
  QlooTag,
  ScoredCandidate,
  SlotResult,
} from "./types";

const SEED_TYPES: EntityType[] = [
  "movie",
  "artist",
  "place",
  "tv_show",
  "destination",
  "brand",
];
const MAX_PER_TYPE = 2;
const ESCALATION_THRESHOLD = 0.03;
const BORING_TAG = /wikipedia_category|nearby_attraction|offerings|credit_card|service_options|service_type|amenity|payment|parking|accessibility|children|wheelchair|crowd|planning|^urn:tag:genre:place$|place:place|restroom|large_group|order_ahead/;
const GOOD_TAG = /genre|keyword|plot|character|style|ambience|decor|cuisine|culinary|mood|audience|theme|motif|vibe|atmosphere|setting|product_category/;

interface Ctx {
  intent: Intent;
  tracer: Tracer;
  seedIds: Record<MemberId, string[]>;
  seedEntities: QlooEntity[];
  cuisineTag: QlooTag | null;
  picks: Map<string, ScoredCandidate>;
}

/**
 * Northbridge Taste Concierge agent loop
 *  1. extract intent (plan kind, who, where, cuisine, slots)
 *  2. resolve Avery's & Morgan's seed tastes → Qloo entity IDs   (GET /search)
 *  3. resolve cuisine keyword → Qloo tag ID                       (GET /v2/tags)
 *  4. per slot: Avery list, Morgan list, joint list               (GET /v2/insights)
 *  5. chain slots: destination → stay/dinner there; dinner → drinks within 1.2 km
 *  6. score every candidate + the LLM-only answer for each partner
 *     (GET /v2/insights with filter.results.entities)
 *  7. policy gate: quiet brief; escalate at most ONE real conflict
 */
export async function runTasteAgent(req: PlanRequest): Promise<PlanResult> {
  const t0 = Date.now();
  const tracer = new Tracer();
  const steps: AgentStep[] = [];
  const step = async <T>(
    id: string,
    label: string,
    fn: () => Promise<{ value: T; detail: string; status?: AgentStep["status"] }>,
  ): Promise<T> => {
    const s0 = Date.now();
    const c0 = tracer.calls.length;
    const { value, detail, status } = await fn();
    steps.push({
      id,
      label,
      status: status ?? "done",
      detail,
      calls: tracer.calls.length - c0,
      ms: Date.now() - s0,
    });
    return value;
  };

  // 1 — intent
  const intent = await step("intent", "Understand the plan", async () => {
    const i = extractIntent(req.plan, { city: req.city, cuisine: req.cuisine });
    return {
      value: i,
      detail: `${i.kindLabel} · for ${i.forWhom.map(memberName).join(" & ")} · ${i.destination ?? i.city}${i.cuisine ? ` · cuisine “${i.cuisine}”` : ""} · slots: ${i.slots.map((s) => s.label).join(", ")}`,
    };
  });

  // 2 — seeds
  const unresolved: string[] = [];
  const seeds = await step("seeds", "Resolve household tastes · GET /search", async () => {
    const out: Record<MemberId, QlooEntity[]> = { avery: [], morgan: [] };
    const jobs: Promise<void>[] = [];
    for (const m of ["avery", "morgan"] as MemberId[]) {
      const s = seedsFor(m, req.household);
      for (const type of SEED_TYPES) {
        for (const name of (s[type] ?? []).slice(0, MAX_PER_TYPE)) {
          jobs.push(
            searchEntities(name, type, { tracer, take: 1 })
              .then((hits) => {
                if (hits[0]) out[m].push(hits[0]);
                else unresolved.push(`${name} (${memberName(m)})`);
              })
              .catch(() => {
                unresolved.push(`${name} (${memberName(m)})`);
              }),
          );
        }
      }
    }
    await Promise.all(jobs);
    const n = out.avery.length + out.morgan.length;
    return {
      value: out,
      status: n ? "done" : "error",
      detail: `${out.avery.length} Avery + ${out.morgan.length} Morgan seeds → Qloo entity IDs${unresolved.length ? ` · not found: ${unresolved.join(", ")}` : ""}`,
    };
  });
  if (!seeds.avery.length && !seeds.morgan.length) {
    throw new Error(
      "Could not resolve any household seeds via Qloo /search (rate limit or network). Try again in a few seconds.",
    );
  }

  // 3 — cuisine tag
  const cuisineTag = await step("tags", "Resolve cuisine filter · GET /v2/tags", async () => {
    if (!intent.cuisine || !intent.slots.some((s) => s.cuisineable)) {
      return { value: null, status: "skipped", detail: "No cuisine in the plan — using Qloo restaurant category" };
    }
    const tags = await searchTags(`${intent.cuisine} restaurant`, { tracer }).catch(() => []);
    const more = tags.length ? [] : await searchTags(intent.cuisine, { tracer }).catch(() => []);
    const all = [...tags, ...more];
    const pick =
      all.find((t) => t.id.startsWith("urn:tag:category:place:")) ??
      all.find((t) => t.id.startsWith("urn:tag:genre:place:restaurant:")) ??
      all.find((t) => t.id.includes(":place")) ??
      null;
    return {
      value: pick,
      status: pick ? "done" : "error",
      detail: pick
        ? `“${intent.cuisine}” → ${pick.name} (${pick.id})`
        : `No Qloo place tag for “${intent.cuisine}” — falling back to restaurants`,
    };
  });

  const ctx: Ctx = {
    intent,
    tracer,
    seedIds: {
      avery: seeds.avery.map((e) => e.id),
      morgan: seeds.morgan.map((e) => e.id),
    },
    seedEntities: [...seeds.avery, ...seeds.morgan],
    cuisineTag,
    picks: new Map(),
  };

  // 4/5/6 — slots (independent first, then chained)
  const results = new Map<string, SlotResult>();
  const independent = intent.slots.filter((s) => !s.location?.startsWith("near:"));
  const chained = intent.slots.filter((s) => s.location?.startsWith("near:"));

  await step(
    "insights",
    "Taste graph per partner + joint · GET /v2/insights",
    async () => {
      const rs = await Promise.all(independent.map((s) => fillSlot(s, ctx)));
      rs.forEach((r) => results.set(r.id, r));
      return {
        value: null,
        status: rs.some((r) => r.pick) ? "done" : "error",
        detail: rs.map(slotDetail).join(" · "),
      };
    },
  );

  await step("chain", "Chain slots off earlier picks", async () => {
    if (!chained.length)
      return { value: null, status: "skipped", detail: "No dependent slots for this plan" };
    const rs = await Promise.all(chained.map((s) => fillSlot(s, ctx)));
    rs.forEach((r) => results.set(r.id, r));
    return {
      value: null,
      detail: rs
        .map((r) => `${r.label}: ${r.context}${r.pick ? ` → ${r.pick.entity.name}` : r.error ? ` (${r.error})` : ""}`)
        .join(" · "),
    };
  });

  const slots = intent.slots.map((s) => results.get(s.id)!).filter(Boolean);

  // 7 — policy gate
  const brief = await step("policy", "Policy gate: quiet brief, escalate ≤ 1 conflict", async () => {
    const b = policyGate(intent, slots);
    return {
      value: b,
      detail: b.escalation
        ? `Escalating 1 question (${slots.find((s) => s.conflict?.escalated)?.label}); everything else decided quietly`
        : "No conflict worth interrupting for — quiet brief only",
    };
  });

  // Contrast — same scoring call grades both columns
  const fits = slots
    .map((s) => (s.pick ? householdFit(s.pick, intent.forWhom) : null))
    .filter((v): v is number => v !== null);
  const llmFits = slots
    .map((s) => (s.llm?.resolved ? householdFit(s.llm.resolved, intent.forWhom) : null))
    .filter((v): v is number => v !== null);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const qAvg = avg(fits);
  const lAvg = avg(llmFits);
  const llmTotal = slots.filter((s) => s.llm).length;
  const llmGrounded = slots.filter((s) => s.llm?.resolved).length;
  const who = intent.forWhom.length > 1 ? "both partners" : memberName(intent.forWhom[0]);
  const headline =
    qAvg !== null && lAvg !== null
      ? `Scored by the same Qloo taste graph, the concierge's picks fit ${who} at ${pct(qAvg)} vs ${pct(lAvg)} for the LLM-only answers.${llmGrounded < llmTotal ? ` ${llmTotal - llmGrounded} LLM answer${llmTotal - llmGrounded > 1 ? "s" : ""} couldn't even be grounded to a real entity.` : ""}`
      : `The concierge grounded ${fits.length} picks in Qloo; the LLM-only column has no household signal.`;

  return {
    ok: true,
    mode: "live",
    plan: intent.raw,
    kind: intent.kind,
    kindLabel: intent.kindLabel,
    forWhom: intent.forWhom,
    city: intent.destination ?? intent.city,
    cuisineTag,
    seeds,
    unresolvedSeeds: unresolved,
    slots,
    brief,
    contrast: {
      qlooAvgFit: qAvg,
      llmAvgFit: lAvg,
      qlooGrounded: slots.filter((s) => s.pick).length,
      llmGrounded,
      llmTotal,
      headline,
    },
    steps,
    calls: tracer.calls,
    elapsedMs: Date.now() - t0,
  };
}

export function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function slotDetail(r: SlotResult): string {
  if (r.error && !r.pick) return `${r.label}: ${r.error}`;
  if (!r.pick) return `${r.label}: no results`;
  if (r.conflict)
    return `${r.label}: partners' top lists overlap ${r.conflict.overlap} → bridge ${r.pick.entity.name}`;
  return `${r.label}: ${r.pick.entity.name}`;
}

/** Fit for the less-happy partner (or the single recipient). */
export function householdFit(c: ScoredCandidate, forWhom: MemberId[]): number | null {
  const vals = forWhom.map((m) => c.fit[m]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  return Math.min(...vals) - (vals.length < forWhom.length ? 0.05 : 0);
}

function dedupe(list: QlooEntity[]): QlooEntity[] {
  const seen = new Set<string>();
  const out: QlooEntity[] = [];
  for (const e of list) {
    const k = e.name.toLowerCase();
    if (seen.has(e.id) || seen.has(k)) continue;
    seen.add(e.id);
    seen.add(k);
    out.push(e);
  }
  return out;
}

function isProduct(e: QlooEntity) {
  return e.tags.some((t) => t.id.startsWith("urn:tag:product_category"));
}

async function fillSlot(spec: SlotSpec, ctx: Ctx): Promise<SlotResult> {
  const { intent, tracer } = ctx;
  const forWhom = intent.forWhom;
  const base: Omit<InsightsQuery, "signalEntityIds"> = { filterType: spec.type };
  let context = spec.type.replace("_", " ");
  let chainedFrom: string | undefined;

  // Filters: tags (cuisine overrides category for cuisineable slots)
  let tags = spec.tags ?? [];
  if (spec.cuisineable && ctx.cuisineTag)
    tags = [...tags.filter((t) => t !== RESTAURANT), ctx.cuisineTag.id];
  if (spec.excludeTags?.length) base.excludeTags = spec.excludeTags;
  if (tags.length) {
    base.filterTags = tags;
    base.tagsIntersect = tags.length > 1;
  }
  const tagLabel =
    spec.cuisineable && ctx.cuisineTag
      ? ctx.cuisineTag.name
      : spec.label.toLowerCase().includes("takeout")
        ? "takeout"
        : spec.tags?.[0]?.split(":").pop()?.replace(/_/g, " ");

  // Location (home city / explicit destination / chained off an earlier pick)
  if (spec.location === "home") {
    base.locationQuery = intent.city;
    context = `${tagLabel ?? context} · ${intent.city}`;
  } else if (spec.location?.startsWith("in:")) {
    base.locationQuery = spec.location.slice(3);
    context = `${tagLabel ?? context} · ${base.locationQuery}`;
  } else if (spec.location?.startsWith("near:")) {
    const parentId = spec.location.slice(5);
    const parent = ctx.picks.get(parentId);
    if (!parent) {
      return emptySlot(spec, context, `needs a ${parentId} pick first`);
    }
    chainedFrom = parentId;
    if (parent.entity.type === "place" && parent.entity.lat !== undefined && parent.entity.lon !== undefined) {
      base.near = { lat: parent.entity.lat, lon: parent.entity.lon, radius: 1200 };
      context = `${tagLabel ?? context} within 1.2 km of ${parent.entity.name}`;
    } else {
      base.locationQuery = parent.entity.name;
      context = `${tagLabel ?? context} · in ${parent.entity.name}`;
    }
  }

  const take = spec.productOnly ? 25 : 8;
  const seedSet = new Set(ctx.seedEntities.map((e) => e.id));
  const seedNames = new Set(ctx.seedEntities.map((e) => e.name.toLowerCase()));
  const clean = (l: QlooEntity[]) => {
    let out = l.filter((e) => !seedSet.has(e.id) && !seedNames.has(e.name.toLowerCase()));
    if (spec.productOnly) {
      const prod = out.filter(isProduct);
      if (prod.length >= 3) out = prod;
    }
    return dedupe(out);
  };

  try {
    // Lists: each partner alone, plus joint (or just the recipient)
    const listJobs: Array<Promise<{ who: MemberId | "joint"; list: QlooEntity[] }>> = [];
    for (const m of forWhom) {
      if (!ctx.seedIds[m].length) continue;
      listJobs.push(
        getInsights(
          { ...base, signalEntityIds: ctx.seedIds[m], take },
          { tracer, purpose: `${spec.label} · ${memberName(m)}'s list` },
        ).then((list) => ({ who: m, list: clean(list) })),
      );
    }
    if (forWhom.length > 1) {
      listJobs.push(
        getInsights(
          { ...base, signalEntityIds: [...ctx.seedIds.avery, ...ctx.seedIds.morgan], take: take + 2 },
          { tracer, purpose: `${spec.label} · joint list` },
        ).then((list) => ({ who: "joint" as const, list: clean(list) })),
      );
    }
    // LLM-only answer resolution runs in parallel
    const llmJob: Promise<QlooEntity | null> =
      spec.llm && !/^an? /i.test(spec.llm.name)
        ? searchEntities(spec.llm.name, spec.llm.type ?? spec.type, { tracer, take: 1 })
            .then((h) => h[0] ?? null)
            .catch(() => null)
        : Promise.resolve(null);

    const [lists, llmEntity] = await Promise.all([Promise.all(listJobs), llmJob]);
    const byWho = new Map(lists.map((l) => [l.who, l.list]));

    // Candidate pool
    const order: Array<MemberId | "joint"> = ["joint", ...forWhom];
    const pool = new Map<string, { entity: QlooEntity; inLists: Array<MemberId | "joint"> }>();
    for (const who of order) {
      for (const e of (byWho.get(who) ?? []).slice(0, spec.productOnly ? 8 : 6)) {
        const cur = pool.get(e.id);
        if (cur) cur.inLists.push(who);
        else pool.set(e.id, { entity: e, inLists: [who] });
      }
    }
    if (!pool.size) return emptySlot(spec, context, "Qloo returned no matches", chainedFrom);

    // Score candidates + LLM answer for each partner (filter.results.entities)
    const scoreIds = [...pool.keys()];
    if (llmEntity && !pool.has(llmEntity.id)) scoreIds.push(llmEntity.id);
    const fitBy = new Map<string, Partial<Record<MemberId, number>>>();
    await Promise.all(
      forWhom
        .filter((m) => ctx.seedIds[m].length)
        .map((m) =>
          getInsights(
            {
              filterType: spec.type,
              signalEntityIds: ctx.seedIds[m],
              resultEntityIds: scoreIds,
              take: scoreIds.length,
            },
            { tracer, purpose: `${spec.label} · score ${scoreIds.length} for ${memberName(m)}` },
          )
            .then((scored) => {
              for (const e of scored) {
                if (e.affinity === undefined) continue;
                const f = fitBy.get(e.id) ?? {};
                f[m] = e.affinity;
                fitBy.set(e.id, f);
              }
            })
            .catch(() => {
              // fall back to list affinities below
            }),
        ),
    );
    // Fallback: affinity from the member's own list
    for (const m of forWhom) {
      for (const e of byWho.get(m) ?? []) {
        const f = fitBy.get(e.id) ?? {};
        if (f[m] === undefined && e.affinity !== undefined) f[m] = e.affinity;
        fitBy.set(e.id, f);
      }
    }

    const toScored = (entity: QlooEntity, inLists: Array<MemberId | "joint">): ScoredCandidate => ({
      entity,
      fit: fitBy.get(entity.id) ?? {},
      inLists,
      sharedTags: sharedTags(entity, ctx.seedEntities, forWhom, ctx),
      links: deepLinks(entity, { lodging: spec.tags?.some((t) => t.includes(":hotel")) }),
    });
    const candidates = [...pool.values()].map((p) => toScored(p.entity, p.inLists));
    const hf = (c: ScoredCandidate) => householdFit(c, forWhom) ?? -1;
    const avgFit = (c: ScoredCandidate) => {
      const v = Object.values(c.fit);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    const ranked = [...candidates].sort((a, b) => hf(b) - hf(a) || avgFit(b) - avgFit(a));
    const pick = ranked[0];

    let conflict: SlotResult["conflict"] = null;
    if (forWhom.length > 1) {
      const aList = byWho.get("avery") ?? [];
      const mList = byWho.get("morgan") ?? [];
      const aIds = new Set(aList.map((e) => e.id));
      const aNames = new Set(aList.map((e) => e.name.toLowerCase()));
      const overlap = mList.filter((e) => aIds.has(e.id) || aNames.has(e.name.toLowerCase())).length;
      const aTop = candidates.find((c) => c.entity.id === aList[0]?.id);
      const mTop = candidates.find((c) => c.entity.id === mList[0]?.id);
      if (overlap === 0 && aTop && mTop && aTop.entity.id !== mTop.entity.id) {
        const g = (c: ScoredCandidate, m: MemberId) => c.fit[m] ?? 0;
        const severity =
          (g(aTop, "avery") - g(mTop, "avery") + (g(mTop, "morgan") - g(aTop, "morgan"))) / 2;
        // the bridge must not be one partner's #1
        const bridge =
          ranked.find((c) => c.entity.id !== aTop.entity.id && c.entity.id !== mTop.entity.id) ?? pick;
        conflict = { severity, overlap, averyPick: aTop, morganPick: mTop, bridge, escalated: false };
      }
    }

    const chosen = conflict?.bridge ?? pick;
    ctx.picks.set(spec.id, chosen);

    return {
      id: spec.id,
      label: spec.label,
      verb: spec.verb,
      type: spec.type,
      context,
      pick: chosen,
      alternates: ranked.filter((c) => c.entity.id !== chosen.entity.id).slice(0, 3),
      conflict,
      llm: spec.llm
        ? {
            name: spec.llm.name,
            why: spec.llm.why,
            resolved: llmEntity ? toScored(llmEntity, []) : null,
          }
        : null,
      chainedFrom,
    };
  } catch (err) {
    return emptySlot(spec, context, err instanceof Error ? err.message : "Qloo error", chainedFrom);
  }
}

function emptySlot(spec: SlotSpec, context: string, error: string, chainedFrom?: string): SlotResult {
  return {
    id: spec.id,
    label: spec.label,
    verb: spec.verb,
    type: spec.type,
    context,
    pick: null,
    alternates: [],
    conflict: null,
    llm: spec.llm ? { name: spec.llm.name, why: spec.llm.why, resolved: null } : null,
    chainedFrom,
    error,
  };
}

function sharedTags(
  e: QlooEntity,
  seeds: QlooEntity[],
  forWhom: MemberId[],
  ctx: Ctx,
): string[] {
  const allowed = new Set(forWhom.flatMap((m) => ctx.seedIds[m]));
  const seedTags = new Map<string, string>();
  for (const s of seeds) {
    if (!allowed.has(s.id)) continue;
    for (const t of s.tags)
      if (!BORING_TAG.test(t.id) && GOOD_TAG.test(t.id)) seedTags.set(t.id, t.name);
  }
  const shared = e.tags.filter((t) => seedTags.has(t.id)).map((t) => t.name);
  return [...new Set(shared)].slice(0, 4);
}

function policyGate(intent: Intent, slots: SlotResult[]): PlanResult["brief"] {
  const policy: string[] = [
    "Quiet by default: decide silently when Avery's and Morgan's taste lists overlap.",
    "When they don't overlap, pick the bridge — the candidate with the best fit for the less-happy partner.",
    "Interrupt with at most one question, only for the most severe conflict on a primary slot.",
  ];
  const conflicts = slots
    .filter((s) => s.conflict)
    .sort((a, b) => (b.conflict!.severity ?? 0) - (a.conflict!.severity ?? 0));
  const primary = conflicts.filter((s) => intent.slots.find((x) => x.id === s.id)?.primary);
  let escalation: string | null = null;
  const top = primary[0];
  if (top && (intent.forceEscalate || top.conflict!.severity >= ESCALATION_THRESHOLD)) {
    top.conflict!.escalated = true;
    const c = top.conflict!;
    escalation = `${top.label}: Avery's and Morgan's top picks share nothing (overlap ${c.overlap}). I went with ${c.bridge.entity.name} — it fits both (${fitStr(c.bridge)}). Prefer Avery's pick, ${c.averyPick.entity.name}, or Morgan's, ${c.morganPick.entity.name}?`;
  }
  for (const s of conflicts) {
    if (!s.conflict!.escalated)
      policy.push(`${s.label}: lists didn't overlap — auto-bridged to ${s.pick?.entity.name} without asking.`);
  }
  if (intent.forWhom.length === 1)
    policy.push(`Gift mode: only ${memberName(intent.forWhom[0])}'s tastes are used as signals (no conflict check needed).`);

  const lines = slots
    .filter((s) => s.pick)
    .map((s) => {
      const p = s.pick!.entity;
      const where = p.type === "place" && p.neighborhood ? ` (${p.neighborhood})` : "";
      return `${s.verb} ${p.name}${where}`;
    });

  return {
    title:
      intent.kind === "gift"
        ? intent.kindLabel
        : `${intent.kindLabel} for ${intent.forWhom.map(memberName).join(" & ")}`,
    lines,
    policy,
    escalation,
  };
}

function fitStr(c: ScoredCandidate) {
  return (["avery", "morgan"] as MemberId[])
    .filter((m) => c.fit[m] !== undefined)
    .map((m) => `${memberName(m)} ${pct(c.fit[m]!)}`)
    .join(" · ");
}
