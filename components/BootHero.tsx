"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Intake from "@/components/Intake";
import { CallsignBadge } from "@/components/hud";
import { PERSONAS } from "@/lib/personas";

const ROSTER = Object.values(PERSONAS).sort((a, b) => a.order - b.order);
const SPECIALISTS = ROSTER.filter((p) => p.callsign !== "INV");

const BOOT_LINES = [
  "meridian v1 · booting",
  `loading specialists … [ ${SPECIALISTS.map((p) => p.callsign).join(" ")} ] ${SPECIALISTS.length} online`,
  "the investor … standby",
  "ready",
];

const STEPS = [
  { n: "01", t: "Paste your product", d: "A live URL, a GitHub repo, or just a description." },
  { n: "02", t: "The team tears it apart", d: "Specialists scan in parallel — UX, code, security, market, ops." },
  { n: "03", t: "Defend it to the investor", d: "Then a sharp investor makes you justify every claim." },
];

export default function BootHero() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setBooted(true);
      return;
    }
    const t = setTimeout(() => setBooted(true), BOOT_LINES.length * 520 + 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16 text-center sm:py-20">
      <AnimatePresence mode="wait">
        {!booted ? (
          <motion.div
            key="boot"
            className="mono w-full max-w-lg text-left text-sm"
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            {BOOT_LINES.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.52, duration: 0.25 }}
                className={i === BOOT_LINES.length - 1 ? "text-accent" : "text-muted"}
              >
                <span className="text-accent">&gt;</span> {line}
                {i === BOOT_LINES.length - 1 && <span className="cursor" />}
              </motion.p>
            ))}
            <button
              onClick={() => setBooted(true)}
              className="mt-6 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              skip ↵
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex w-full flex-col items-center"
          >
            <div className="mono mb-6 flex items-center gap-2 text-sm tracking-[0.3em] text-muted">
              <span className="text-accent glow">⊕</span> MERIDIAN
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
              Find every flaw before your users — and investors — do.
            </h1>

            <p className="mt-5 max-w-xl text-lg text-muted">
              Paste your product. A team of specialist agents tears it apart in parallel — then makes
              you defend it.
            </p>

            <div className="mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2">
              {ROSTER.map((p) => (
                <span key={p.callsign} className="flex items-center gap-1.5">
                  <CallsignBadge callsign={p.callsign} color={p.color} />
                  <span className="mono text-xs tracking-wider text-muted">{p.label}</span>
                </span>
              ))}
            </div>

            <div className="mt-10 w-full max-w-xl">
              <Intake />
            </div>

            <div className="mt-16 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-lg border border-border bg-panel p-5 panel-glow">
                  <div className="mono mb-2 text-sm font-semibold text-accent">{s.n}</div>
                  <p className="font-medium">{s.t}</p>
                  <p className="mt-1 text-sm text-muted">{s.d}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
