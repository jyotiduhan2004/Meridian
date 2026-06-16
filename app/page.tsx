import Intake from "@/components/Intake";

const TEAM = [
  { emoji: "📋", role: "Product Lead" },
  { emoji: "🎨", role: "UX Designer" },
  { emoji: "🧪", role: "QA Engineer" },
  { emoji: "📊", role: "Market Researcher" },
  { emoji: "🔒", role: "Security Engineer" },
  { emoji: "⚙️", role: "DevOps Engineer" },
  { emoji: "🦈", role: "The Investor" },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-6 text-xs uppercase tracking-[0.3em] text-muted">Meridian</span>

      <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
        Find every flaw before your users — and investors — do.
      </h1>

      <p className="mt-5 max-w-xl text-lg text-muted">
        Paste your product. A team of specialist agents tears it apart in parallel — then makes
        you defend it.
      </p>

      <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {TEAM.map((t) => (
          <span
            key={t.role}
            className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted"
          >
            <span className="mr-1">{t.emoji}</span>
            {t.role}
          </span>
        ))}
      </div>

      <div className="mt-10">
        <Intake />
      </div>
    </main>
  );
}
