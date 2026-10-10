"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeepLink,
  EntityType,
  MemberId,
  PlanResult,
  QlooEntity,
  ScoredCandidate,
  Seeds,
  SlotResult,
} from "@/lib/types";
import { HOUSEHOLD } from "@/lib/household";

const PRESETS: Array<{ plan: string; title: string; blurb: string; tag: string }> = [
  { plan: "Friday night in", title: "Friday night in", blurb: "Takeout + film + playlist. Watch the film conflict get escalated.", tag: "Escalation" },
  { plan: "Date night out", title: "Date night out", blurb: "Dinner → cocktail bar within 1.2 km of it (chained geo query).", tag: "Chaining" },
  { plan: "Weekend trip", title: "Weekend trip", blurb: "Destination both love → hotel + dinner in that destination.", tag: "Cross-domain" },
  { plan: "Movie night — we can never agree", title: "Movie night, we never agree", blurb: "Avery's list vs Morgan's list vs the bridge pick.", tag: "Conflict" },
  { plan: "Gift for Morgan", title: "Gift for Morgan", blurb: "Only Morgan's tastes: object, book, and concert tickets.", tag: "Single signal" },
  { plan: "Friday night in, Japanese takeout", title: "Japanese takeout night", blurb: "Cuisine resolved through /v2/tags into a real Qloo filter.", tag: "/v2/tags" },
];

const LOADING_STEPS = [
  "Understanding the plan",
  "Resolving Avery's & Morgan's tastes · GET /search",
  "Avery's list, Morgan's list, joint list · GET /v2/insights",
  "Chaining slots off earlier picks",
  "Scoring every candidate + the LLM-only answer for each partner",
  "Policy gate: quiet brief, at most one question",
];

const TYPE_LABEL: Record<string, string> = {
  movie: "Film",
  artist: "Artist",
  place: "Place",
  tv_show: "TV",
  destination: "Destination",
  brand: "Brand",
  book: "Book",
};
const SEED_TYPES: EntityType[] = ["movie", "artist", "place", "tv_show", "destination", "brand"];
const STORAGE_KEY = "northbridge-household-v1";

type Household = Record<MemberId, Seeds>;
const DEFAULT_HOUSEHOLD: Household = {
  avery: HOUSEHOLD[0].seeds,
  morgan: HOUSEHOLD[1].seeds,
};

const pct = (v?: number) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

export function ConciergeApp() {
  const [plan, setPlan] = useState("Friday night in");
  const [city, setCity] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [household, setHousehold] = useState<Household>(DEFAULT_HOUSEHOLD);
  const [edited, setEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Household;
        if (parsed.avery && parsed.morgan) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setHousehold(parsed);
          setEdited(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, [loading]);

  const updateHousehold = (h: Household) => {
    setHousehold(h);
    setEdited(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
  };
  const resetHousehold = () => {
    setHousehold(DEFAULT_HOUSEHOLD);
    setEdited(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const run = useCallback(
    async (nextPlan?: string, nextCuisine?: string) => {
      const p = (nextPlan ?? plan).trim() || "Friday night in";
      setPlan(p);
      if (nextCuisine !== undefined) setCuisine(nextCuisine);
      setLoading(true);
      setLoadStep(0);
      setError(null);
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: p,
            city: city || undefined,
            cuisine: (nextCuisine ?? cuisine) || undefined,
            household: edited ? household : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        setResult(data as PlanResult);
        requestAnimationFrame(() =>
          document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    },
    [plan, city, cuisine, edited, household],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Northbridge · Household agent
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" /> Live Qloo taste graph
          </span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Taste Concierge
        </h1>
        <p className="max-w-3xl text-lg leading-relaxed text-stone-600">
          Avery and Morgan share a home, not a taste. Give their agent a vague plan and it returns a
          short, bookable brief that fits <em>both</em> of them — decided quietly, with one question
          only when their tastes genuinely collide.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Explainer n={1} title="Tastes → Qloo entities">
            Each partner&apos;s favorite films, artists, restaurants and places are resolved with{" "}
            <code>/search</code>.
          </Explainer>
          <Explainer n={2} title="Per-partner + joint taste graph">
            <code>/v2/insights</code> runs for Avery, for Morgan, and jointly; every candidate is
            scored for each partner and the best <strong>bridge</strong> wins.
          </Explainer>
          <Explainer n={3} title="Grade the LLM-only answer">
            The same scoring call grades what a generic assistant would say. That gap is the value of
            Qloo.
          </Explainer>
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <label htmlFor="plan" className="text-sm font-medium text-stone-700">
          What are we planning?
        </label>
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            id="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && run()}
            placeholder="e.g. Date night out, Weekend trip to Lisbon, Gift for Avery"
            className="flex-[3] rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-stone-900 outline-none ring-emerald-500 focus:ring-2"
          />
          <input
            aria-label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (default San Francisco)"
            className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none ring-emerald-500 focus:ring-2"
          />
          <input
            aria-label="Cuisine"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="Cuisine (optional)"
            className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none ring-emerald-500 focus:ring-2"
          />
          <button
            type="button"
            onClick={() => run()}
            disabled={loading}
            className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? "Planning…" : "Plan with taste"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.plan}
              type="button"
              disabled={loading}
              onClick={() => run(p.plan, "")}
              className="group flex flex-col items-start gap-1 rounded-xl border border-stone-200 bg-stone-50 p-3 text-left transition hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-60"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-semibold text-stone-800 group-hover:text-emerald-900">{p.title}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500 ring-1 ring-stone-200">
                  {p.tag}
                </span>
              </span>
              <span className="text-xs text-stone-500">{p.blurb}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}{" "}
            <button className="underline" onClick={() => run()}>
              Retry
            </button>
          </p>
        )}
      </section>

      <HouseholdPanel
        household={household}
        edited={edited}
        resolved={result?.seeds}
        unresolved={result?.unresolvedSeeds ?? []}
        onChange={updateHousehold}
        onReset={resetHousehold}
      />

      {loading && <LoadingTrace step={loadStep} />}
      {!loading && result && <ResultView key={result.plan + result.elapsedMs} result={result} />}
      {!loading && !result && (
        <p className="text-center text-sm text-stone-500">
          Pick a scenario above — each one runs live against Qloo (typically 2–8 seconds).
        </p>
      )}
    </div>
  );
}

function Explainer({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600 [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:text-[12px]">
      <p className="mb-1 flex items-center gap-2 font-semibold text-stone-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[11px] text-white">
          {n}
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}

function LoadingTrace({ step }: { step: number }) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5">
      <p className="mb-3 text-sm font-semibold text-emerald-800">Agent running against the live Qloo API…</p>
      <ol className="space-y-1.5 text-sm">
        {LOADING_STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i <= step ? "text-stone-800" : "text-stone-300"}`}>
            <span
              className={`h-2 w-2 rounded-full ${i < step ? "bg-emerald-600" : i === step ? "animate-pulse bg-amber-500" : "bg-stone-200"}`}
            />
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------- household ----------------

function HouseholdPanel({
  household,
  edited,
  resolved,
  unresolved,
  onChange,
  onReset,
}: {
  household: Household;
  edited: boolean;
  resolved?: Record<MemberId, QlooEntity[]>;
  unresolved: string[];
  onChange: (h: Household) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">The household</h2>
          <p className="text-sm text-stone-600">
            Two people, two tastes. These seeds are the only thing the agent knows — everything else comes from Qloo.
          </p>
        </div>
        <div className="flex gap-2">
          {edited && (
            <button onClick={onReset} className="rounded-lg px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100">
              Reset to defaults
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-emerald-600"
          >
            {open ? "Done editing" : "Edit tastes"}
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {HOUSEHOLD.map((m) => (
          <MemberCard
            key={m.id}
            id={m.id}
            name={m.name}
            notes={m.notes}
            seeds={household[m.id]}
            resolved={resolved?.[m.id]}
            editing={open}
            onChange={(s) => onChange({ ...household, [m.id]: s })}
          />
        ))}
      </div>
      {unresolved.length > 0 && (
        <p className="mt-3 text-xs text-amber-700">Not found in Qloo: {unresolved.join(", ")}</p>
      )}
    </section>
  );
}

function MemberCard({
  id,
  name,
  notes,
  seeds,
  resolved,
  editing,
  onChange,
}: {
  id: MemberId;
  name: string;
  notes: string;
  seeds: Seeds;
  resolved?: QlooEntity[];
  editing: boolean;
  onChange: (s: Seeds) => void;
}) {
  const [draft, setDraft] = useState("");
  const [type, setType] = useState<EntityType>("movie");
  const color = id === "avery" ? "bg-sky-600" : "bg-violet-600";
  const imgFor = (n: string) =>
    resolved?.find((e) => e.name.toLowerCase() === n.toLowerCase() || e.name.toLowerCase().startsWith(n.toLowerCase()))?.image;
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-stone-900">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs text-white ${color}`}>{name[0]}</span>
        {name}
      </p>
      <p className="mt-1 text-xs text-stone-500">{notes}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SEED_TYPES.flatMap((t) =>
          (seeds[t] ?? []).map((n) => {
            const img = imgFor(n);
            return (
              <span
                key={`${t}-${n}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white py-0.5 pl-0.5 pr-2.5 text-xs"
              >
                {img ? (
                  <img src={img} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-stone-100" />
                )}
                <span className="font-medium text-stone-800">{n}</span>
                <span className="text-[10px] text-stone-400">{TYPE_LABEL[t]}</span>
                {editing && (
                  <button
                    aria-label={`Remove ${n}`}
                    className="ml-0.5 text-stone-400 hover:text-red-600"
                    onClick={() => onChange({ ...seeds, [t]: (seeds[t] ?? []).filter((x) => x !== n) })}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          }),
        )}
      </div>
      {editing && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = draft.trim();
            if (!v) return;
            onChange({ ...seeds, [type]: [...(seeds[type] ?? []), v].slice(-2) });
            setDraft("");
          }}
        >
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EntityType)}
            className="rounded-lg border border-stone-300 bg-white px-2 text-xs"
          >
            {SEED_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Add something ${name} loves`}
            className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs"
          />
          <button className="rounded-lg bg-stone-800 px-3 text-xs font-medium text-white">Add</button>
        </form>
      )}
      {editing && <p className="mt-1 text-[10px] text-stone-400">Up to 2 per type are sent as Qloo signals. Saved in this browser.</p>}
    </div>
  );
}

// ---------------- results ----------------

function ResultView({ result }: { result: PlanResult }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const effective = useMemo(
    () =>
      result.slots.map((s) => {
        const id = overrides[s.id];
        if (!id || !s.pick) return s;
        const pool = [
          s.pick,
          ...s.alternates,
          ...(s.conflict ? [s.conflict.averyPick, s.conflict.morganPick, s.conflict.bridge] : []),
        ];
        const chosen = pool.find((c) => c.entity.id === id);
        return chosen ? { ...s, pick: chosen } : s;
      }),
    [result.slots, overrides],
  );

  const escalated = result.slots.find((s) => s.conflict?.escalated);
  const answered = escalated ? Boolean(overrides[escalated.id]) : true;
  const two = result.forWhom.length > 1;

  const briefText = [
    `${result.brief.title}`,
    ...effective
      .filter((s) => s.pick)
      .map((s) => {
        const e = s.pick!.entity;
        const where = e.type === "place" && e.neighborhood ? ` (${e.neighborhood})` : "";
        const link = s.pick!.links[0]?.href;
        return `• ${s.verb} ${e.name}${where}${link ? ` — ${link}` : ""}`;
      }),
  ].join("\n");

  return (
    <div id="results" className="flex scroll-mt-6 flex-col gap-6">
      <ContrastHero result={result} />

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-300 bg-white p-5 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Quiet brief</p>
              <h2 className="text-xl font-semibold text-stone-900">{result.brief.title}</h2>
              <p className="text-xs text-stone-500">
                {result.city}
                {result.cuisineTag ? ` · ${result.cuisineTag.name}` : ""}
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(briefText);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-emerald-600"
            >
              {copied ? "Copied ✓" : "Copy for the group chat"}
            </button>
          </div>
          <ol className="flex flex-col gap-2">
            {effective
              .filter((s) => s.pick)
              .map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl bg-stone-50 p-2.5">
                  <span className="w-5 text-center font-mono text-xs text-stone-400">{i + 1}</span>
                  <Thumb e={s.pick!.entity} size="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-500">
                      {s.verb} <span className="font-semibold text-stone-900">{s.pick!.entity.name}</span>
                      {s.chainedFrom && (
                        <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                          chained from {result.slots.find((x) => x.id === s.chainedFrom)?.label}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-stone-400">{metaLine(s.pick!.entity)}</p>
                  </div>
                  <div className="hidden gap-1 sm:flex">
                    {s.pick!.links.slice(0, 2).map((l) => (
                      <LinkChip key={l.href} l={l} />
                    ))}
                  </div>
                </li>
              ))}
          </ol>
          {result.slots.some((s) => s.error) && (
            <p className="text-xs text-amber-700">
              {result.slots
                .filter((s) => s.error)
                .map((s) => `${s.label}: ${s.error}`)
                .join(" · ")}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2">
          {escalated && escalated.conflict ? (
            <EscalationCard
              slot={escalated}
              chosen={overrides[escalated.id] ?? escalated.conflict.bridge.entity.id}
              answered={answered}
              onChoose={(id) => setOverrides((o) => ({ ...o, [escalated.id]: id }))}
            />
          ) : (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">No questions for you.</p>
              <p className="mt-1 text-emerald-800">
                {two
                  ? "Avery's and Morgan's tastes were close enough (or conflicts were minor) — the agent decided everything quietly."
                  : `Only ${result.forWhom[0] === "avery" ? "Avery" : "Morgan"}'s tastes matter here, so there is nothing to negotiate.`}
              </p>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Policy</p>
            <ul className="space-y-1 text-xs text-stone-500">
              {result.brief.policy.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 text-xs font-semibold uppercase tracking-wide md:grid-cols-5">
          <p className="text-emerald-700 md:col-span-3">Qloo-grounded concierge</p>
          <p className="hidden text-stone-500 md:col-span-2 md:block">LLM-only answer (no taste graph)</p>
        </div>
        {effective.map((s) => (
          <SlotRow
            key={s.id}
            slot={s}
            two={two}
            forWhom={result.forWhom}
            onPick={(id) => setOverrides((o) => ({ ...o, [s.id]: id }))}
          />
        ))}
        <p className="text-xs text-stone-400">
          LLM-only answers are representative static defaults a generic assistant gives for these plans (no LLM is
          called). They are resolved with Qloo <code>/search</code> and scored in the <em>same</em>{" "}
          <code>/v2/insights</code> call as the concierge&apos;s candidates, so the comparison is apples to apples.
        </p>
      </section>

      <AgentTrace result={result} />
    </div>
  );
}

function ContrastHero({ result }: { result: PlanResult }) {
  const { qlooAvgFit, llmAvgFit, headline, llmGrounded, llmTotal, qlooGrounded } = result.contrast;
  const label = result.forWhom.length > 1 ? "fit for the less-happy partner" : "fit for the recipient";
  return (
    <section className="grid gap-4 rounded-2xl bg-stone-900 p-6 text-white md:grid-cols-3">
      <div className="md:col-span-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Why Qloo matters</p>
        <p className="mt-2 text-lg leading-snug">{headline}</p>
      </div>
      <BigStat
        tone="emerald"
        title="Qloo-grounded concierge"
        value={qlooAvgFit}
        sub={`${qlooGrounded} real, bookable entities · ${label}`}
      />
      <BigStat
        tone="stone"
        title="LLM-only answer"
        value={llmAvgFit}
        sub={`${llmGrounded}/${llmTotal} even resolve to a real entity · ${label}`}
      />
    </section>
  );
}

function BigStat({ tone, title, value, sub }: { tone: "emerald" | "stone"; title: string; value: number | null; sub: string }) {
  const bar = tone === "emerald" ? "bg-emerald-400" : "bg-stone-400";
  const w = value ? Math.max(0, Math.min(100, ((value - 0.5) / 0.5) * 100)) : 0;
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-stone-300">{title}</p>
      <p className={`mt-1 text-4xl font-semibold ${tone === "emerald" ? "text-emerald-300" : "text-stone-300"}`}>
        {value !== null ? pct(value) : "—"}
      </p>
      <div className="mt-2 h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${w}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-stone-400">{sub}</p>
    </div>
  );
}

function EscalationCard({
  slot,
  chosen,
  answered,
  onChoose,
}: {
  slot: SlotResult;
  chosen: string;
  answered: boolean;
  onChoose: (id: string) => void;
}) {
  const c = slot.conflict!;
  const options: Array<{ key: string; label: string; cand: ScoredCandidate }> = [
    { key: "bridge", label: "Bridge (agent's pick)", cand: c.bridge },
    { key: "avery", label: "Avery's #1", cand: c.averyPick },
    { key: "morgan", label: "Morgan's #1", cand: c.morganPick },
  ];
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        {answered ? "Answered — brief updated" : "One question (the only one)"}
      </p>
      <p className="mt-1 text-sm text-amber-950">
        <strong>{slot.label}:</strong> Avery&apos;s and Morgan&apos;s top {slot.type === "movie" ? "films" : "picks"} from
        Qloo share <strong>{c.overlap}</strong> titles. I chose a bridge that fits both. Keep it, or go with one of
        yours?
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((o) => {
          const active = chosen === o.cand.entity.id;
          return (
            <button
              key={o.key}
              onClick={() => onChoose(o.cand.entity.id)}
              className={`flex items-center gap-3 rounded-lg border p-2 text-left transition ${active ? "border-emerald-600 bg-white ring-2 ring-emerald-500" : "border-amber-200 bg-white/60 hover:bg-white"}`}
            >
              <Thumb e={o.cand.entity} size="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{o.label}</p>
                <p className="truncate text-sm font-medium text-stone-900">{o.cand.entity.name}</p>
              </div>
              <div className="w-28">
                <FitBars fit={o.cand.fit} forWhom={["avery", "morgan"]} compact />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  two,
  forWhom,
  onPick,
}: {
  slot: SlotResult;
  two: boolean;
  forWhom: MemberId[];
  onPick: (id: string) => void;
}) {
  const p = slot.pick;
  return (
    <div className="grid gap-3 md:grid-cols-5">
      <article className="rounded-2xl border border-emerald-200 bg-white p-4 md:col-span-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-stone-500">{slot.label}</span>
          <span className="text-stone-400">{slot.context}</span>
          {slot.conflict ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              lists overlap {slot.conflict.overlap} → bridged{slot.conflict.escalated ? " · asked you" : " quietly"}
            </span>
          ) : two && p ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              shared taste · decided quietly
            </span>
          ) : null}
        </div>
        {p ? (
          <div className="flex gap-4">
            <Thumb e={p.entity} size="h-24 w-20" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-stone-900">{p.entity.name}</p>
              <p className="text-xs text-stone-500">{metaLine(p.entity)}</p>
              {p.entity.description && (
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">{p.entity.description}</p>
              )}
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <FitBars fit={p.fit} forWhom={forWhom} />
                <div className="text-xs text-stone-500">
                  {p.sharedTags.length > 0 && (
                    <p>
                      <span className="text-stone-400">Shares with their seeds:</span>{" "}
                      {p.sharedTags.map((t) => (
                        <span key={t} className="mr-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-700">
                          {t}
                        </span>
                      ))}
                    </p>
                  )}
                  <p className="mt-1 text-stone-400">
                    Found in: {p.inLists.map((w) => (w === "joint" ? "joint list" : `${w === "avery" ? "Avery" : "Morgan"}'s list`)).join(", ") || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.links.map((l) => (
                  <LinkChip key={l.href} l={l} />
                ))}
              </div>
              {slot.alternates.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-stone-400">Swap for:</span>
                  {slot.alternates.map((a) => (
                    <button
                      key={a.entity.id}
                      onClick={() => onPick(a.entity.id)}
                      className="max-w-[16rem] truncate rounded-full border border-stone-200 px-2 py-0.5 text-stone-600 hover:border-emerald-500 hover:text-emerald-800"
                      title={Object.entries(a.fit).map(([k, v]) => `${k} ${pct(v)}`).join(" · ")}
                    >
                      {a.entity.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-700">No grounded pick: {slot.error ?? "no results"}</p>
        )}
      </article>
      <aside className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 md:col-span-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400 md:hidden">LLM-only answer</p>
        {slot.llm ? (
          <div className="flex gap-3">
            {slot.llm.resolved ? <Thumb e={slot.llm.resolved.entity} size="h-16 w-14" muted /> : null}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-stone-700">{slot.llm.name}</p>
              <p className="mt-0.5 text-xs text-stone-500">{slot.llm.why}</p>
              <div className="mt-2">
                {slot.llm.resolved && Object.keys(slot.llm.resolved.fit).length > 0 ? (
                  <FitBars fit={slot.llm.resolved.fit} forWhom={forWhom} muted />
                ) : slot.llm.resolved ? (
                  <p className="text-xs text-stone-400">
                    Real entity, but Qloo finds no affinity with this household&apos;s tastes.
                  </p>
                ) : (
                  <p className="text-xs text-stone-400">Not a real entity — can&apos;t be grounded, scored, or booked.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-400">—</p>
        )}
      </aside>
    </div>
  );
}

function FitBars({
  fit,
  forWhom,
  compact,
  muted,
}: {
  fit: Partial<Record<MemberId, number>>;
  forWhom: MemberId[];
  compact?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {forWhom.map((m) => {
        const v = fit[m];
        const w = typeof v === "number" ? Math.max(2, Math.min(100, ((v - 0.5) / 0.5) * 100)) : 0;
        const color = muted ? "bg-stone-400" : m === "avery" ? "bg-sky-500" : "bg-violet-500";
        return (
          <div key={m} className="flex items-center gap-2 text-[11px] text-stone-500">
            {!compact && <span className="w-12">{m === "avery" ? "Avery" : "Morgan"}</span>}
            {compact && <span className="w-3 font-semibold">{m === "avery" ? "A" : "M"}</span>}
            <span className="h-1.5 flex-1 rounded-full bg-stone-200">
              <span className={`block h-1.5 rounded-full ${color}`} style={{ width: `${w}%` }} />
            </span>
            <span className="w-8 text-right tabular-nums">{pct(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Thumb({ e, size, muted }: { e: QlooEntity; size: string; muted?: boolean }) {
  if (!e.image)
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-stone-100 text-lg font-semibold text-stone-400`}>
        {e.name[0]}
      </div>
    );
  return (
    <img
      src={e.image}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded-lg object-cover ${muted ? "opacity-60 grayscale" : ""}`}
    />
  );
}

function LinkChip({ l }: { l: DeepLink }) {
  const icon: Record<DeepLink["kind"], string> = {
    map: "📍",
    book: "🗓",
    watch: "▶",
    listen: "♫",
    tickets: "🎟",
    web: "↗",
    shop: "🛍",
    info: "ⓘ",
  };
  return (
    <a
      href={l.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 hover:border-emerald-500 hover:text-emerald-800"
    >
      <span aria-hidden>{icon[l.kind]}</span>
      {l.label}
    </a>
  );
}

function metaLine(e: QlooEntity): string {
  const parts: string[] = [];
  if (e.type === "place") {
    if (e.neighborhood) parts.push(e.neighborhood);
    if (e.city) parts.push(e.city);
    if (e.rating) parts.push(`★ ${e.rating}`);
    if (e.priceLevel) parts.push("$".repeat(e.priceLevel));
  } else {
    parts.push(TYPE_LABEL[e.type] ?? e.type);
    if (e.year) parts.push(String(e.year));
    if (e.genres?.length) parts.push(e.genres.slice(0, 2).join(", "));
    else if (e.disambiguation && e.disambiguation !== e.name && !/^\d{4}$/.test(e.disambiguation))
      parts.push(e.disambiguation);
  }
  return parts.join(" · ");
}

function AgentTrace({ result }: { result: PlanResult }) {
  const [open, setOpen] = useState(false);
  const live = result.calls.filter((c) => c.status !== "cache").length;
  const cachedCalls = result.calls.length - live;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Agent trace</h2>
        <p className="text-xs text-stone-400">
          {result.calls.length} Qloo calls ({live} live, {cachedCalls} server-cached) · {(result.elapsedMs / 1000).toFixed(1)}s
          {result.cached ? " · full plan served from cache" : ""}
        </p>
      </div>
      <ol className="mt-3 space-y-2">
        {result.steps.map((s, i) => (
          <li key={s.id} className="flex gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm">
            <span className="font-mono text-xs text-stone-400">{i + 1}.</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-stone-800">{s.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${s.status === "done" ? "bg-emerald-100 text-emerald-800" : s.status === "error" ? "bg-red-100 text-red-800" : "bg-stone-200 text-stone-500"}`}
                >
                  {s.status}
                </span>
                {s.calls > 0 && <span className="text-[11px] text-stone-400">{s.calls} calls · {s.ms} ms</span>}
              </div>
              <p className="mt-0.5 text-xs text-stone-500">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <button onClick={() => setOpen((o) => !o)} className="mt-3 text-xs font-medium text-emerald-700 hover:underline">
        {open ? "Hide" : "Show"} every Qloo request
      </button>
      {open && (
        <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-stone-200">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-stone-100 text-stone-500">
              <tr>
                <th className="px-2 py-1">Endpoint</th>
                <th className="px-2 py-1">Purpose</th>
                <th className="px-2 py-1">Key params</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Results</th>
              </tr>
            </thead>
            <tbody>
              {result.calls.map((c, i) => (
                <tr key={i} className="border-t border-stone-100 align-top">
                  <td className="px-2 py-1 font-mono">{c.endpoint}</td>
                  <td className="px-2 py-1">{c.purpose}</td>
                  <td className="max-w-[22rem] px-2 py-1 font-mono text-stone-500">
                    {Object.entries(c.params)
                      .filter(([k]) => k !== "signal.interests.entities" && k !== "filter.results.entities")
                      .map(([k, v]) => `${k}=${v}`)
                      .join(" ")}
                    {c.params["signal.interests.entities"] &&
                      ` signal.interests.entities=[${c.params["signal.interests.entities"].split(",").length} ids]`}
                    {c.params["filter.results.entities"] &&
                      ` filter.results.entities=[${c.params["filter.results.entities"].split(",").length} ids]`}
                  </td>
                  <td className="px-2 py-1">{c.status}</td>
                  <td className="px-2 py-1">{c.results}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
