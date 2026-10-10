import { ConciergeApp } from "@/components/ConciergeApp";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50">
      <ConciergeApp />
      <footer className="border-t border-stone-200 px-4 py-8 text-center text-xs text-stone-500">
        Northbridge Taste Concierge · Avery &amp; Morgan · Built for the Qloo Agentic Hackathon · Powered by the Qloo API (<code className="font-mono">/search</code>, <code className="font-mono">/v2/insights</code>,{" "}
        <code className="font-mono">/v2/tags</code>) ·{" "}
        <a className="underline" href="https://github.com/dl88jing/northbridge-taste">
          Source (MIT)
        </a>
      </footer>
    </main>
  );
}
