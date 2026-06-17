"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { personaFor } from "@/lib/personas";
import { trackEvent } from "@/lib/track";
import type { SkillEnvelope } from "@/lib/schema";

type Verdict = {
  meridianScore: number;
  scoreBreakdown: { specialist: string; score: number; weight: number }[];
  conflicts: { topic: string; a: string; b: string; resolution: string }[];
  fixList: { title: string; severity: string; skillId: string }[];
  verdict: "ship" | "ship-with-fixes" | "not-yet";
  note: string;
};
type Skipped = { skillId: string; specialist: string; reason: string };
type Run = {
  id: string;
  mode: string;
  plan: string[];
  skipped: Skipped[];
  skills: Record<string, SkillEnvelope>;
  verdict: Verdict | null;
};

const DOT: Record<string, string> = {
  pending: "bg-muted/40",
  running: "bg-accent animate-pulse",
  done: "bg-emerald-400",
  partial: "bg-yellow-400",
  failed: "bg-red-400",
  skipped: "bg-muted/30",
};
const SEV: Record<string, string> = {
  critical: "text-red-400 border-red-400/30 bg-red-400/10",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  low: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  nit: "text-muted border-border bg-card",
};
const STANCE: Record<string, string> = {
  block: "text-red-400 border-red-400/40",
  "fix-first": "text-yellow-400 border-yellow-400/40",
  ship: "text-emerald-400 border-emerald-400/40",
};
const VERDICT_STYLE: Record<string, string> = {
  ship: "text-emerald-400",
  "ship-with-fixes": "text-yellow-400",
  "not-yet": "text-red-400",
};
const VERDICT_LABEL: Record<string, string> = {
  ship: "SHIP IT",
  "ship-with-fixes": "SHIP WITH FIXES",
  "not-yet": "NOT YET",
};
const VERDICT_RING: Record<string, string> = {
  ship: "#34d399",
  "ship-with-fixes": "#fbbf24",
  "not-yet": "#f87171",
};

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
    while (queue.length) {
      const it = queue.shift();
      if (it !== undefined) await fn(it);
    }
  });
  await Promise.all(workers);
}

export default function ReportClient({ id }: { id: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("overview");
  const started = useRef(false);

  const setSkill = useCallback((env: SkillEnvelope) => {
    setRun((prev) => (prev ? { ...prev, skills: { ...prev.skills, [env.skillId]: env } } : prev));
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/run/${id}`, { cache: "no-store" });
      if (!r.ok) {
        setNotFound(true);
        return;
      }
      const data: Run = await r.json();
      setRun(data);
      if (data.verdict) setVerdict(data.verdict);
      if (started.current) return;
      started.current = true;

      const pending = Object.values(data.skills)
        .filter((s) => s.status === "pending")
        .map((s) => s.skillId);

      await pool(pending, 2, async (sid) => {
        try {
          const res = await fetch(`/api/run/${id}/skill/${sid}`, { method: "POST" });
          if (res.ok) {
            const env: SkillEnvelope = await res.json();
            setSkill(env);
            trackEvent("skill_completed", {
              skill: env.skillId,
              status: env.status,
              score: env.score ?? -1,
            });
          }
        } catch {
          /* leave as pending; the dashboard tolerates it */
        }
      });

      const sv = await fetch(`/api/run/${id}/synthesize`, { method: "POST" });
      if (sv.ok) {
        const v: Verdict = await sv.json();
        setVerdict(v);
        trackEvent("verdict_synthesized", { score: v.meridianScore, verdict: v.verdict });
      }
    })();
  }, [id, setSkill]);

  if (notFound) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted">This analysis was not found (the in-memory store resets on restart).</p>
        <Link href="/" className="text-accent hover:underline">
          ← Start a new analysis
        </Link>
      </main>
    );
  }

  if (!run) {
    return <main className="flex-1 flex items-center justify-center p-8 text-muted">Loading…</main>;
  }

  const skills = Object.values(run.skills);
  const totalDone = skills.filter((s) => s.status === "done" || s.status === "partial").length;
  const progress = skills.length ? Math.round((totalDone / skills.length) * 100) : 0;

  const bySpec = new Map<string, SkillEnvelope[]>();
  for (const s of skills) {
    if (!bySpec.has(s.specialist)) bySpec.set(s.specialist, []);
    bySpec.get(s.specialist)!.push(s);
  }
  const specialists = [...bySpec.entries()].sort(
    (a, b) => personaFor(a[0]).order - personaFor(b[0]).order,
  );

  return (
    <main className="flex-1 w-full">
      {/* sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3.5">
          <Link href="/" className="text-sm text-muted transition hover:text-foreground">
            ← Meridian
          </Link>
          <div className="ml-auto flex items-center gap-3.5">
            {verdict ? (
              <>
                <ScoreRing score={verdict.meridianScore} color={VERDICT_RING[verdict.verdict]} />
                <div className="leading-tight">
                  <div className={`text-base font-bold ${VERDICT_STYLE[verdict.verdict]}`}>
                    {VERDICT_LABEL[verdict.verdict]}
                  </div>
                  <div className="text-xs text-muted">
                    {totalDone}/{skills.length} specialists · {progress}%
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 text-sm text-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                The team is analyzing… {progress}%
              </div>
            )}
          </div>
        </div>
        {/* tab bar */}
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3">
          <TabBtn active={tab === "overview"} color="#4f9cf9" emoji="📊" label="Overview" onClick={() => setTab("overview")} />
          {specialists.map(([spec, list]) => {
            const p = personaFor(spec);
            return (
              <TabBtn
                key={spec}
                active={tab === spec}
                color={p.color}
                emoji={p.emoji}
                label={p.persona}
                count={list.length}
                onClick={() => setTab(spec)}
              />
            );
          })}
          {verdict && (
            <TabBtn
              active={tab === "investor"}
              color={personaFor("Investor").color}
              emoji="🦈"
              label="The Investor"
              onClick={() => setTab("investor")}
            />
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        {tab === "overview" && (
          <Overview verdict={verdict} run={run} progress={progress} onJump={(s) => setTab(s)} />
        )}
        {specialists.map(([spec, list]) =>
          tab === spec ? <SpecialistPane key={spec} spec={spec} list={list} /> : null,
        )}
        {tab === "investor" && <Investor runId={id} ready={!!verdict} />}
      </div>
    </main>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  return (
    <div
      className="relative h-12 w-12 shrink-0 rounded-full"
      style={{ background: `conic-gradient(${color} ${score * 3.6}deg, var(--border) 0)` }}
    >
      <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-background text-base font-semibold">
        {score}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  color,
  emoji,
  label,
  count,
  onClick,
}: {
  active: boolean;
  color: string;
  emoji: string;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm transition hover:text-foreground"
      style={active ? { color } : undefined}
    >
      <span>{emoji}</span>
      <span className={active ? "font-semibold" : "text-muted"}>{label}</span>
      {count != null && (
        <span className="rounded-full bg-card-2 px-1.5 py-0.5 text-xs text-muted">{count}</span>
      )}
      {active && (
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: color }} />
      )}
    </button>
  );
}

function Overview({
  verdict,
  run,
  progress,
  onJump,
}: {
  verdict: Verdict | null;
  run: Run;
  progress: number;
  onJump: (spec: string) => void;
}) {
  const pm = personaFor("PM");
  if (!verdict) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted">The team is analyzing your product…</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted">Open a specialist tab above to watch findings land live.</p>
      </div>
    );
  }
  return (
    <div className="space-y-7">
      {/* PM synthesis */}
      <section
        className="rounded-2xl border p-6"
        style={{ borderColor: `${pm.color}55`, background: `${pm.color}0f` }}
      >
        <div className="mb-2 flex items-center gap-2 text-sm" style={{ color: pm.color }}>
          <span>{pm.emoji}</span>
          <span className="font-semibold">{pm.persona}</span>
          <span className="text-muted">· {pm.display}</span>
        </div>
        <p className="text-lg leading-relaxed">{verdict.note}</p>
      </section>

      {/* specialist score bars */}
      {verdict.scoreBreakdown.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm uppercase tracking-wider text-muted">Specialist scores</h2>
          <div className="space-y-2">
            {verdict.scoreBreakdown.map((b) => {
              const p = personaFor(b.specialist);
              return (
                <button
                  key={b.specialist}
                  onClick={() => onJump(b.specialist)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-left transition hover:bg-card-2"
                >
                  <span className="w-28 shrink-0 text-sm">
                    <span className="mr-1">{p.emoji}</span>
                    {p.persona}
                  </span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-background">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${b.score * 10}%`, background: p.color }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-medium">{b.score}/10</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* conflicts */}
      {verdict.conflicts.length > 0 && (
        <section className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-5">
          <p className="mb-2 text-sm font-semibold text-yellow-400">⚠ Team conflict</p>
          {verdict.conflicts.map((c, i) => (
            <div key={i} className="text-sm text-muted">
              <p>{c.a}</p>
              <p>{c.b}</p>
              <p className="mt-2 text-foreground">📋 {c.resolution}</p>
            </div>
          ))}
        </section>
      )}

      {/* prioritized fixes */}
      {verdict.fixList.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm uppercase tracking-wider text-muted">Prioritized fixes</h2>
          <ol className="space-y-2">
            {verdict.fixList.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="text-muted">{i + 1}</span>
                <span className={`rounded border px-1.5 py-0.5 text-xs ${SEV[f.severity] ?? SEV.nit}`}>
                  {f.severity}
                </span>
                <span>{f.title}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* didn't run */}
      {run.skipped.length > 0 && <DidntRun skipped={run.skipped} />}
    </div>
  );
}

function DidntRun({ skipped }: { skipped: Skipped[] }) {
  const bySpec = new Map<string, Skipped[]>();
  for (const s of skipped) {
    if (!bySpec.has(s.specialist)) bySpec.set(s.specialist, []);
    bySpec.get(s.specialist)!.push(s);
  }
  const groups = [...bySpec.entries()].sort(
    (a, b) => personaFor(a[0]).order - personaFor(b[0]).order,
  );
  return (
    <section>
      <h2 className="mb-3 text-sm uppercase tracking-wider text-muted">Didn&apos;t run</h2>
      <div className="space-y-2">
        {groups.map(([spec, items]) => {
          const p = personaFor(spec);
          return (
            <div key={spec} className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <span className="font-medium" style={{ color: p.color }}>
                {p.emoji} {p.persona}
              </span>
              <span className="text-muted">
                {" "}
                — {items.map((i) => i.skillId).join(", ")} · {items[0].reason}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SpecialistPane({ spec, list }: { spec: string; list: SkillEnvelope[] }) {
  const p = personaFor(spec);
  const scored = list.filter((s) => s.score != null);
  const avg = scored.length
    ? Math.round((scored.reduce((a, s) => a + (s.score as number), 0) / scored.length) * 10) / 10
    : null;
  return (
    <div>
      <div
        className="mb-5 rounded-2xl border p-5"
        style={{ borderColor: `${p.color}55`, background: `${p.color}0f` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{p.emoji}</span>
          <div>
            <div className="text-lg font-semibold" style={{ color: p.color }}>
              {p.persona}
            </div>
            <div className="text-sm text-muted">{p.display}</div>
          </div>
          {avg != null && (
            <div className="ml-auto text-2xl font-semibold">
              {avg}
              <span className="text-sm text-muted">/10</span>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {list.map((s) => (
          <SkillCard key={s.skillId} skill={s} color={p.color} />
        ))}
      </div>
    </div>
  );
}

function SkillCard({ skill, color }: { skill: SkillEnvelope; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[skill.status] ?? DOT.pending}`} />
        <span className="font-mono text-sm text-muted">{skill.skillId}</span>
        {skill.stance && skill.stance !== "n/a" && STANCE[skill.stance] && (
          <span className={`rounded border px-1.5 py-0.5 text-xs ${STANCE[skill.stance]}`}>
            {skill.stance}
          </span>
        )}
        {skill.score != null && (
          <span className="ml-auto text-lg font-semibold">
            {skill.score}
            <span className="text-xs text-muted">/10</span>
          </span>
        )}
      </div>
      {skill.note && <p className="mb-3 text-sm text-muted">{skill.note}</p>}
      {skill.findings.length > 0 ? (
        <ul className="space-y-3">
          {skill.findings.map((f, i) => (
            <li key={i} className="rounded-lg bg-card-2 p-3">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 rounded border px-1.5 py-0.5 text-xs ${SEV[f.severity] ?? SEV.nit}`}>
                  {f.severity}
                </span>
                <span className="text-sm font-medium">{f.title}</span>
              </div>
              {f.evidence && <p className="mt-2 text-sm text-muted">{f.evidence}</p>}
              {f.fix && (
                <p className="mt-2 text-sm" style={{ color }}>
                  → {f.fix}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : skill.status === "failed" ? (
        <p className="text-sm text-red-400">This check errored{skill.note ? ` — ${skill.note}` : "."}</p>
      ) : skill.status === "running" || skill.status === "pending" ? (
        <p className="text-sm text-muted">Working…</p>
      ) : (
        <p className="text-sm text-muted">No issues found.</p>
      )}
    </div>
  );
}

function Investor({ runId, ready }: { runId: string; ready: boolean }) {
  const [turns, setTurns] = useState<{ who: "investor" | "you"; text: string }[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const p = personaFor("Investor");

  async function next(answerText?: string) {
    setBusy(true);
    try {
      const round = turns.filter((t) => t.who === "investor").length;
      if (answerText) trackEvent("founder_response_submitted", { round });
      else if (round === 0) trackEvent("debate_started", {});
      const r = await fetch(`/api/run/${runId}/investor`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: answerText ?? "", history: turns }),
      });
      const d = await r.json();
      setTurns((t) => [
        ...t,
        ...(answerText ? [{ who: "you" as const, text: answerText }] : []),
        { who: "investor" as const, text: d.turn },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-sm text-muted">The Investor enters once the verdict is in…</p>;

  return (
    <section
      className="rounded-2xl border p-6"
      style={{ borderColor: `${p.color}55`, background: `${p.color}0f` }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">🦈</span>
        <span className="font-semibold" style={{ color: p.color }}>
          {p.persona} — {p.display}
        </span>
      </div>
      {turns.length === 0 ? (
        <button
          onClick={() => next()}
          disabled={busy}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
          style={{ background: p.color }}
        >
          {busy ? "…" : "Face the Investor →"}
        </button>
      ) : (
        <div className="space-y-3">
          {turns.map((t, i) => (
            <p key={i} className={`text-sm ${t.who === "investor" ? "text-foreground" : "text-muted"}`}>
              <span className="mr-1">{t.who === "investor" ? "🦈" : "🧑"}</span>
              {t.text}
            </p>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && answer.trim() && !busy) {
                  next(answer.trim());
                  setAnswer("");
                }
              }}
              placeholder="Defend your product…"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => {
                if (answer.trim()) {
                  next(answer.trim());
                  setAnswer("");
                }
              }}
              disabled={busy || !answer.trim()}
              className="rounded-lg px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
              style={{ background: p.color }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
