"use client";

import { motion } from "motion/react";
import Intake from "@/components/Intake";
import { CallsignBadge, StatusLine } from "@/components/hud";
import { PERSONAS } from "@/lib/personas";

// ── Data ───────────────────────────────────────────────────────────────────
const ROSTER = Object.values(PERSONAS).sort((a, b) => a.order - b.order);

const STEPS = [
  { n: "01", t: "Paste your product", d: "A live URL, a GitHub repo, a Devpost link, or just a description — Meridian figures out the rest." },
  { n: "02", t: "The team tears it apart", d: "Specialists scan in parallel — UX, code, security, market, ops — grounded in your real repo and live pages." },
  { n: "03", t: "Defend it to the investor", d: "Then a sharp investor makes you justify every claim, using exactly what the team found." },
];

const PROBLEMS = [
  { t: "No second pair of eyes", d: "You ship fast — but there's no UX lead, no security review, no market check. Whole categories of flaws never get looked at." },
  { t: "Blind spots compound", d: "A broken flow, an exposed key, a thin market — each one quietly caps your launch, and you can't fix what nobody flagged." },
  { t: "Then the investor asks", d: "In the room, you get grilled on the exact things you never stress-tested. The questions you can't answer are the ones that sink you." },
];

const CHECKS: Record<string, string> = {
  PM: "Scope, MVP cut list & business model",
  UX: "Visual design, copy & the user journey",
  QA: "Code quality, API health & edge cases",
  MKT: "Competitors, pricing & market size",
  SEC: "OWASP risks, secrets & dependencies",
  OPS: "Performance, scale & launch readiness",
  INV: "Grills you on every weak claim you make",
};

const TECH = [
  { c: "#22d3ee", t: "Gemini 2.5 Flash", s: "reasoning + vision" },
  { c: "#a78bfa", t: "Multi-agent orchestration", s: "parallel specialist fan-out" },
  { c: "#f472b6", t: "Browserless", s: "live screenshots → vision" },
  { c: "#fbbf24", t: "Tavily", s: "market web search" },
  { c: "#38bdf8", t: "GitHub API", s: "real repo evidence" },
  { c: "#2dd4bf", t: "Supabase", s: "run persistence" },
  { c: "#f87171", t: "Next.js 16 · React 19", s: "App Router + Turbopack" },
  { c: "#818cf8", t: "Tailwind v4 · Motion", s: "the glass HUD" },
];

// ── Motion helpers (reduced-motion safe via Motion's own handling) ──────────
const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono mb-3 text-xs uppercase tracking-[0.3em] text-accent">{children}</p>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`mono inline-flex items-center gap-2 tracking-[0.28em] ${className}`}>
      <span className="text-accent glow">⊕</span> MERIDIAN
    </span>
  );
}

// ── Nav ─────────────────────────────────────────────────────────────────────
function Nav() {
  const links = [
    ["Problem", "#problem"],
    ["How it works", "#how"],
    ["Agents", "#agents"],
    ["Tech", "#tech"],
  ];
  return (
    <nav className="sticky top-0 z-50 glass border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="text-sm font-medium text-foreground">
          <Wordmark />
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="text-sm text-muted transition hover:text-foreground">
              {label}
            </a>
          ))}
        </div>
        <a
          href="#intake"
          className="pill bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:brightness-110"
          style={{ boxShadow: "0 0 22px -6px var(--accent)" }}
        >
          Run the team →
        </a>
      </div>
    </nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <header id="top" className="relative mx-auto max-w-4xl px-5 pt-16 pb-10 text-center sm:pt-24">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <span className="glass pill mb-7 px-4 py-1.5 text-xs text-muted">
          <span className="text-accent">⊕</span> your product team, on demand
        </span>

        <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] sm:text-6xl">
          Find every flaw <span className="text-gradient">before your users</span>
          <br className="hidden sm:block" /> — and investors — do.
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted">
          Paste your product. A team of specialist agents tears it apart in parallel — grounded in
          your real code and live pages — then makes you defend it.
        </p>

        <div className="mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {ROSTER.map((p) => (
            <span key={p.callsign} className="flex items-center gap-1.5">
              <CallsignBadge callsign={p.callsign} color={p.color} />
              <span className="mono text-xs tracking-wider text-muted">{p.label}</span>
            </span>
          ))}
        </div>

        <div id="intake" className="mt-11 w-full max-w-xl scroll-mt-24">
          <Intake />
        </div>
      </motion.div>
    </header>
  );
}

// ── Section shell ────────────────────────────────────────────────────────────
function Section({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24 ${className}`}>
      {children}
    </section>
  );
}

// ── Problem ──────────────────────────────────────────────────────────────────
function ProblemSection() {
  return (
    <Section id="problem">
      <motion.div {...reveal} className="max-w-2xl">
        <Eyebrow>The problem</Eyebrow>
        <h2 className="text-3xl font-bold sm:text-4xl">
          Shipping is easy. Shipping something that holds up isn&apos;t.
        </h2>
        <p className="mt-4 text-lg text-muted">
          Solo builders and small teams move fast — but the review layer a real product org has is
          exactly what&apos;s missing when it matters most.
        </p>
      </motion.div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {PROBLEMS.map((p, i) => (
          <motion.div
            key={p.t}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.08 }}
            className="glass rounded-[20px] p-6"
          >
            <span className="mono text-sm text-accent">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 text-lg font-semibold">{p.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.d}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ── How it works (split layout) ──────────────────────────────────────────────
function HowItWorks() {
  return (
    <Section id="how">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div {...reveal}>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-3xl font-bold sm:text-4xl">Three steps to a verdict.</h2>
          <ol className="mt-8 space-y-6">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="sphere mono grid h-10 w-10 shrink-0 place-items-center text-sm font-semibold text-background" style={{ "--c": "#22d3ee" } as React.CSSProperties}>
                  {s.n}
                </span>
                <div>
                  <p className="text-lg font-semibold">{s.t}</p>
                  <p className="mt-1 text-sm text-muted">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>

        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
          <div className="glass glow-cyan rounded-[20px] p-6">
            <div className="mono mb-4 flex items-center justify-between text-xs text-muted">
              <span>meridian · live scan</span>
              <span className="text-accent">running</span>
            </div>
            <div className="space-y-2.5">
              <StatusLine label="audit-visual-ux" status="done" />
              <StatusLine label="review-code-quality" status="done" />
              <StatusLine label="scan-owasp" status="done" />
              <StatusLine label="analyze-competitors" status="done" />
              <StatusLine label="estimate-scalability" status="running" />
            </div>
            <div className="rule-fade my-5" />
            <div className="flex items-center justify-between">
              <span className="mono text-xs text-muted">meridian score</span>
              <span className="mono text-2xl font-semibold text-accent">67<span className="text-sm text-muted">/100</span></span>
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

// ── Agents ───────────────────────────────────────────────────────────────────
function AgentsSection() {
  const specialists = ROSTER.filter((p) => p.callsign !== "INV");
  const investor = ROSTER.find((p) => p.callsign === "INV")!;
  return (
    <Section id="agents">
      <motion.div {...reveal} className="max-w-2xl">
        <Eyebrow>The team</Eyebrow>
        <h2 className="text-3xl font-bold sm:text-4xl">Seven specialists. One verdict.</h2>
        <p className="mt-4 text-lg text-muted">
          Each agent owns a domain and scores it independently. Their findings roll up into a single
          Meridian Score — then the investor stress-tests the result.
        </p>
      </motion.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specialists.map((p, i) => (
          <motion.div
            key={p.callsign}
            {...reveal}
            transition={{ ...reveal.transition, delay: (i % 3) * 0.06 }}
            className="glass flex items-start gap-4 rounded-[20px] p-5"
          >
            <span
              className="sphere mono grid h-12 w-12 shrink-0 place-items-center text-xs font-bold text-background"
              style={{ "--c": p.color } as React.CSSProperties}
            >
              {p.callsign}
            </span>
            <div>
              <p className="font-semibold" style={{ color: p.color }}>{p.role}</p>
              <p className="mt-1 text-sm text-muted">{CHECKS[p.callsign]}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Investor — set apart */}
      <motion.div
        {...reveal}
        className="glass glow-cyan mt-4 flex flex-col items-start gap-4 rounded-[20px] p-6 sm:flex-row sm:items-center"
        style={{ borderColor: `${investor.color}55` }}
      >
        <span
          className="sphere mono grid h-14 w-14 shrink-0 place-items-center text-sm font-bold text-background"
          style={{ "--c": investor.color } as React.CSSProperties}
        >
          {investor.callsign}
        </span>
        <div className="flex-1">
          <p className="text-lg font-semibold" style={{ color: investor.color }}>The Investor — the boss battle</p>
          <p className="mt-1 text-sm text-muted">{CHECKS.INV}. Grounded in the team&apos;s real findings, so you can&apos;t bluff your way out.</p>
        </div>
      </motion.div>
    </Section>
  );
}

// ── Tech stack ────────────────────────────────────────────────────────────────
function TechStack() {
  return (
    <Section id="tech">
      <motion.div {...reveal} className="max-w-2xl">
        <Eyebrow>Under the hood</Eyebrow>
        <h2 className="text-3xl font-bold sm:text-4xl">Built to look at the real thing.</h2>
        <p className="mt-4 text-lg text-muted">
          No hand-waving — Meridian reads your actual repo, fetches your live pages, screenshots your
          UI, and searches the market, then reasons over all of it.
        </p>
      </motion.div>
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TECH.map((t, i) => (
          <motion.div
            key={t.t}
            {...reveal}
            transition={{ ...reveal.transition, delay: (i % 4) * 0.05 }}
            className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.c, boxShadow: `0 0 10px ${t.c}` }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.t}</p>
              <p className="mono truncate text-xs text-muted">{t.s}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ── Footer CTA ────────────────────────────────────────────────────────────────
function FooterCTA() {
  return (
    <Section id="cta">
      <motion.div {...reveal} className="glass glow-cyan flex flex-col items-center gap-5 rounded-[28px] px-6 py-14 text-center">
        <h2 className="max-w-xl text-3xl font-bold sm:text-4xl">
          Ready to face <span className="text-gradient">the team</span>?
        </h2>
        <p className="max-w-md text-muted">Paste your product and find out what your specialists — and your investor — would say.</p>
        <a
          href="#intake"
          className="pill bg-accent px-6 py-3 text-sm font-semibold text-background transition hover:brightness-110"
          style={{ boxShadow: "0 0 28px -6px var(--accent)" }}
        >
          Run the team →
        </a>
      </motion.div>
      <div className="rule-fade mt-16" />
      <div className="mt-6 flex flex-col items-center justify-between gap-2 text-xs text-muted sm:flex-row">
        <Wordmark className="text-muted" />
        <span>Built for the Mind the Product hackathon.</span>
      </div>
    </Section>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="flex-1">
      <Nav />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorks />
        <AgentsSection />
        <TechStack />
        <FooterCTA />
      </main>
    </div>
  );
}
