import { ConciergeApp } from "@/components/ConciergeApp";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <ConciergeApp />
      <footer className="border-t border-stone-200 px-4 py-8 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
        Northbridge Taste Concierge · Avery &amp; Morgan · Qloo Agentic Hackathon
        · Insights API (<code className="font-mono">/v2/insights</code> +{" "}
        <code className="font-mono">/search</code>) · MIT
      </footer>
    </main>
  );
}
