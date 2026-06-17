import Intake from "@/components/Intake";
import { PERSONAS } from "@/lib/personas";

const TEAM = Object.values(PERSONAS).sort((a, b) => a.order - b.order);

const STEPS = [
  { n: "1", t: "Paste your product", d: "A live URL, a GitHub repo, or just a description." },
  { n: "2", t: "The team tears it apart", d: "Specialists analyze in parallel — UX, code, security, market, ops." },
  { n: "3", t: "Defend it to the Investor", d: "Then a sharp investor makes you justify every claim." },
];

export default function Home() {
  return (
    <main className="glow flex-1 flex flex-col items-center px-6 py-16 text-center sm:py-20">
      <span className="mb-6 text-xs uppercase tracking-[0.3em] text-muted">Meridian</span>

      <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
        Find every flaw before your users — and investors — do.
      </h1>

      <p className="mt-5 max-w-xl text-lg text-muted">
        Paste your product. A team of specialist agents tears it apart in parallel — then makes you
        defend it.
      </p>

      {/* the team, each in their signature color */}
      <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {TEAM.map((t) => (
          <span
            key={t.persona}
            className="rounded-full border px-3 py-1.5 text-sm"
            style={{ borderColor: `${t.color}40`, background: `${t.color}10` }}
          >
            <span className="mr-1.5">{t.emoji}</span>
            <span className="font-medium" style={{ color: t.color }}>
              {t.persona}
            </span>
            <span className="text-muted"> · {t.display}</span>
          </span>
        ))}
      </div>

      <div className="mt-10 w-full max-w-xl">
        <Intake />
      </div>

      {/* how it works */}
      <div className="mt-16 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
              {s.n}
            </div>
            <p className="font-medium">{s.t}</p>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
