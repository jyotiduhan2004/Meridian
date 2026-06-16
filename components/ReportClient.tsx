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
type Run = {
  id: string;
  mode: string;
  plan: string[];
  skipped: { skillId: string; reason: string }[];
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
      if (started.current) return;
      started.current = true;

      const pending = Object.values(data.skills)
        .filter((s) => s.status === "pending")
        .map((s) => s.skillId);

      await pool(pending, 4, async (sid) => {
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
    return (
      <main className="flex-1 flex items-center justify-center p-8 text-muted">Loading…</main>
    );
  }

  const skills = Object.values(run.skills);
  const totalDone = skills.filter((s) => s.status === "done" || s.status === "partial").length;
  const progress = skills.length ? Math.round((totalDone / skills.length) * 100) : 0;

  // group skills by specialist, ordered
  const bySpec = new Map<string, SkillEnvelope[]>();
  for (const s of skills) {
    if (!bySpec.has(s.specialist)) bySpec.set(s.specialist, []);
    bySpec.get(s.specialist)!.push(s);
  }
  const specialists = [...bySpec.entries()].sort(
    (a, b) => personaFor(a[0]).order - personaFor(b[0]).order,
  );

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Meridian
        </Link>
        <span className="text-xs text-muted">
          {totalDone}/{skills.length} specialists reported · {progress}%
        </span>
      </div>

      {/* verdict header */}
      <section className="mb-8 rounded-2xl border border-border bg-card p-6">
        {verdict ? (
          <div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Meridian Score</p>
                <p className="text-5xl font-semibold">{verdict.meridianScore}<span className="text-2xl text-muted">/100</span></p>
              </div>
              <div className={`text-2xl font-bold ${VERDICT_STYLE[verdict.verdict]}`}>
                {VERDICT_LABEL[verdict.verdict]}
              </div>
            </div>
            <p className="mt-3 text-muted">
              <span className="text-foreground">📋 Priya:</span> {verdict.note}
            </p>
            {verdict.scoreBreakdown.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                {verdict.scoreBreakdown.map((b) => (
                  <span key={b.specialist} className="rounded-md border border-border px-2 py-1">
                    {personaFor(b.specialist).emoji} {b.score}/10 · w{b.weight}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">The team is analyzing your product…</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* conflicts */}
      {verdict && verdict.conflicts.length > 0 && (
        <section className="mb-8 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-5">
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

      {/* fix list */}
      {verdict && verdict.fixList.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-muted">Prioritized fixes</h2>
          <ol className="space-y-2">
            {verdict.fixList.map((f, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm">
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

      {/* specialist grid */}
      <section className="grid gap-4 sm:grid-cols-2">
        {specialists.map(([spec, list]) => {
          const p = personaFor(spec);
          return (
            <div key={spec} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">{p.emoji}</span>
                <span className="font-medium">{p.persona}</span>
                <span className="text-xs text-muted">· {p.display}</span>
              </div>
              <div className="space-y-3">
                {list.map((s) => (
                  <div key={s.skillId}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${DOT[s.status] ?? DOT.pending}`} />
                      <span className="font-mono text-xs text-muted">{s.skillId}</span>
                      {s.score != null && <span className="ml-auto text-xs">{s.score}/10</span>}
                    </div>
                    {s.findings.map((f, i) => (
                      <div key={i} className="ml-4 mt-1.5 text-xs">
                        <span className={`mr-1 rounded border px-1 py-0.5 ${SEV[f.severity] ?? SEV.nit}`}>
                          {f.severity}
                        </span>
                        <span className="text-foreground">{f.title}</span>
                        {f.fix && <span className="block text-muted">→ {f.fix}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {run.skipped.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Skipped: {run.skipped.map((s) => s.skillId).join(", ")} (missing inputs)
        </p>
      )}

      <Investor runId={id} ready={!!verdict} />
    </main>
  );
}

function Investor({ runId, ready }: { runId: string; ready: boolean }) {
  const [turns, setTurns] = useState<{ who: "investor" | "you"; text: string }[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function next(answerText?: string) {
    setBusy(true);
    try {
      const round = turns.filter((t) => t.who === "investor").length;
      if (answerText) trackEvent("founder_response_submitted", { round });
      else if (round === 0) trackEvent("debate_started", {});
      const r = await fetch(`/api/run/${runId}/investor`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ round, answer: answerText ?? "" }),
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

  if (!ready) return null;

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 font-medium">🦈 The Investor</p>
      {turns.length === 0 ? (
        <button
          onClick={() => next()}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
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
          <div className="flex gap-2">
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
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => {
                if (answer.trim()) {
                  next(answer.trim());
                  setAnswer("");
                }
              }}
              disabled={busy || !answer.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
