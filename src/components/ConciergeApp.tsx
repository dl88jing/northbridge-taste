"use client";

import { useCallback, useState } from "react";
import type { PlanResult } from "@/lib/types";

const PRESETS = [
  "Friday night in",
  "Weekend trip",
  "Gift for Morgan",
  "Gift for Avery",
  "Date night out",
];

export function ConciergeApp() {
  const [plan, setPlan] = useState("Friday night in");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (nextPlan?: string) => {
    const p = (nextPlan ?? plan).trim() || "Friday night in";
    setPlan(p);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult(data as PlanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [plan]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3 border-b border-stone-200 pb-8 dark:border-stone-700">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Northbridge · Household agent
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl dark:text-stone-50">
          Taste Concierge
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-stone-600 dark:text-stone-300">
          Avery &amp; Morgan&apos;s agent turns a vague plan into a short,
          taste-grounded itinerary — dining, film/TV, music, travel — via Qloo
          search + Insights. Side-by-side with an LLM-only guess so you can see
          why cultural intelligence matters.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <label className="text-sm font-medium text-stone-700 dark:text-stone-200">
          What are we planning?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Friday night in"
            className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-stone-900 outline-none ring-emerald-500 focus:ring-2 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-50"
          />
          <button
            type="button"
            onClick={() => run()}
            disabled={loading}
            className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? "Running agent…" : "Plan with taste"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => run(p)}
              className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:border-emerald-600 hover:text-emerald-800 dark:border-stone-600 dark:text-stone-300"
            >
              {p}
            </button>
          ))}
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </section>

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: PlanResult }) {
  return (
    <div className="flex flex-col gap-6">
      {result.mode === "mock" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>Mock / demo mode.</strong>{" "}
          {result.comparisonNote}
        </div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Agent loop
        </h2>
        <ol className="space-y-2">
          {result.steps.map((s, i) => (
            <li
              key={s.id}
              className="flex gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-800/60"
            >
              <span className="font-mono text-xs text-stone-400">
                {i + 1}.
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-800 dark:text-stone-100">
                    {s.label}
                  </span>
                  <StatusPill status={s.status} />
                  {s.mock && <MockPill />}
                </div>
                {s.detail && (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {s.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {result.resolvedSeeds.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Resolved Qloo seeds
          </h2>
          <div className="flex flex-wrap gap-2">
            {result.resolvedSeeds.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs dark:border-stone-600 dark:bg-stone-800"
              >
                <span className="font-medium text-stone-800 dark:text-stone-100">
                  {e.name}
                </span>
                <span className="text-stone-400">{e.type}</span>
                {e.mock && <MockPill />}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <BriefCard
          accent="emerald"
          title={result.qlooBrief.title}
          summary={result.qlooBrief.summary}
          cards={result.qlooBrief.itinerary}
          escalations={result.qlooBrief.escalations}
          policyNotes={result.qlooBrief.policyNotes}
        />
        <BriefCard
          accent="stone"
          title={result.llmOnlyBrief.title}
          summary={result.llmOnlyBrief.summary}
          cards={result.llmOnlyBrief.itinerary}
          escalations={[]}
          policyNotes={result.llmOnlyBrief.policyNotes}
        />
      </div>

      <p className="text-center text-xs text-stone-500 dark:text-stone-400">
        Win rule: if this worked the same without Qloo, we built the wrong thing.
        The left column depends on /search + /v2/insights; the right does not.
      </p>
    </div>
  );
}

function BriefCard({
  title,
  summary,
  cards,
  escalations,
  policyNotes,
  accent,
}: {
  title: string;
  summary: string;
  cards: PlanResult["qlooBrief"]["itinerary"];
  escalations: string[];
  policyNotes: string[];
  accent: "emerald" | "stone";
}) {
  const border =
    accent === "emerald"
      ? "border-emerald-300 dark:border-emerald-800"
      : "border-stone-300 dark:border-stone-600";
  const head =
    accent === "emerald"
      ? "text-emerald-800 dark:text-emerald-300"
      : "text-stone-600 dark:text-stone-300";

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border-2 ${border} bg-white p-5 dark:bg-stone-900`}
    >
      <h2 className={`text-lg font-semibold ${head}`}>{title}</h2>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        {summary}
      </p>
      <ul className="flex flex-col gap-3">
        {cards.map((c) => (
          <li
            key={`${c.domain}-${c.entity.id}`}
            className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/70"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {c.domain}
              </span>
              <span className="text-[10px] uppercase text-stone-400">
                {c.source}
                {c.entity.mock ? " · fixture" : ""}
              </span>
            </div>
            <p className="mt-1 font-medium text-stone-900 dark:text-stone-50">
              {c.entity.name}
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {c.why}
            </p>
          </li>
        ))}
      </ul>
      {escalations.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <strong>Escalation:</strong> {escalations.join(" · ")}
        </div>
      )}
      <ul className="space-y-1 text-[11px] text-stone-400">
        {policyNotes.map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
    running: "bg-sky-100 text-sky-800",
    error: "bg-red-100 text-red-800",
    pending: "bg-stone-100 text-stone-500",
    skipped: "bg-stone-100 text-stone-500",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors[status] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}

function MockPill() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      mock
    </span>
  );
}
