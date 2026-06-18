"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { personaFor } from "@/lib/personas";
import { trackEvent } from "@/lib/track";
import type { SkillEnvelope } from "@/lib/schema";
import { CallsignBadge, ChannelBar, Panel, ScoreRing, SeverityTag, StatusLine } from "@/components/hud";

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

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`mono inline-flex items-center gap-1.5 font-semibold tracking-[0.2em] ${className}`}>
      <span className="text-accent glow">⊕</span>
      MERIDIAN
    </span>
  );
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
            trackEvent("skill_completed", { skill: env.skillId, status: env.status, score: env.score ?? -1 });
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
        <p className="mono text-sm text-muted">
          <span className="text-red-400">! </span>analysis not found — the in-memory store resets on restart.
        </p>
        <Link href="/" className="text-accent hover:underline">
          ← new analysis
        </Link>
      </main>
    );
  }

  if (!run) {
    return <main className="mono flex-1 flex items-center justify-center p-8 text-muted">booting…</main>;
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
      {/* sticky HUD header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
          <Link href="/" className="text-sm text-muted transition hover:text-foreground">
            <Wordmark className="text-sm" />
          </Link>
          <div className="ml-auto flex items-center gap-3.5">
            {verdict ? (
              <>
                <ScoreRing score={verdict.meridianScore} color={VERDICT_RING[verdict.verdict]} size={56} />
                <div className="leading-tight">
                  <div className={`mono text-base font-bold ${VERDICT_STYLE[verdict.verdict]}`}>
                    {VERDICT_LABEL[verdict.verdict]}
                  </div>
                  <div className="mono text-xs text-muted">
                    {totalDone}/{skills.length} online · {progress}%
                  </div>
                </div>
              </>
            ) : (
              <div className="mono flex items-center gap-2 text-sm text-accent">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                <span className="cursor">analyzing… {progress}%</span>
              </div>
            )}
          </div>
        </div>
        {/* channel tabs */}
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3">
          <TabBtn active={tab === "overview"} color="var(--accent)" label="OVERVIEW" onClick={() => setTab("overview")} />
          {specialists.map(([spec, list]) => {
            const p = personaFor(spec);
            return (
              <TabBtn
                key={spec}
                active={tab === spec}
                color={p.color}
                callsign={p.callsign}
                label={p.label}
                count={list.length}
                onClick={() => setTab(spec)}
              />
            );
          })}
          {verdict && (
            <TabBtn
              active={tab === "investor"}
              color={personaFor("Investor").color}
              callsign="INV"
              label="THE INVESTOR"
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

function TabBtn({
  active,
  color,
  callsign,
  label,
  count,
  onClick,
}: {
  active: boolean;
  color: string;
  callsign?: string;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 whitespace-nowrap px-3.5 py-3 text-sm transition hover:text-foreground"
      style={active ? { color } : undefined}
    >
      {callsign && <CallsignBadge callsign={callsign} color={color} active={active} />}
      <span className={`mono tracking-wider ${active ? "font-semibold" : "text-muted"}`}>{label}</span>
      {count != null && (
        <span className="mono rounded-full bg-panel-2 px-1.5 py-0.5 text-xs text-muted">{count}</span>
      )}
      {active && (
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      )}
    </button>
  );
}

const reveal = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: i * 0.06, ease: "easeOut" as const },
});

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
      <Panel active className="p-6">
        <p className="mono text-sm text-accent cursor">running specialists…</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%`, boxShadow: "0 0 12px var(--accent)" }} />
        </div>
        <p className="mono mt-3 text-xs text-muted">open a channel above to watch findings resolve live.</p>
      </Panel>
    );
  }
  const deadDeploy = run.skipped.find((s) => /unreachable/i.test(s.reason));
  return (
    <div className="space-y-7">
      {/* deploy unreachable — one clear banner instead of N duplicate 404 findings */}
      {deadDeploy && (
        <motion.div {...reveal(0)}>
          <div className="rounded-lg border border-orange-400/40 bg-orange-400/5 p-5">
            <p className="mono mb-1 text-sm font-semibold tracking-wider text-orange-400">⚠ DEPLOY UNREACHABLE</p>
            <p className="text-sm text-muted">
              {deadDeploy.reason}. The live-page review is paused — scoring reflects only what the team could
              actually assess (repo, market &amp; product). Re-run once the URL is live for the UX, journey, and
              performance review.
            </p>
          </div>
        </motion.div>
      )}

      {/* PRODUCT synthesis */}
      <motion.div {...reveal(0)}>
        <Panel className="p-6" >
          <div className="mb-2 flex items-center gap-2">
            <CallsignBadge callsign={pm.callsign} color={pm.color} />
            <span className="mono text-sm tracking-wider" style={{ color: pm.color }}>{pm.label}</span>
            <span className="mono text-xs text-muted">· verdict</span>
          </div>
          <p className="text-lg leading-relaxed">{verdict.note}</p>
        </Panel>
      </motion.div>

      {/* channel scores */}
      {verdict.scoreBreakdown.length > 0 && (
        <motion.section {...reveal(1)}>
          <h2 className="mono mb-3 text-xs uppercase tracking-[0.2em] text-muted">channel scores</h2>
          <div className="space-y-2">
            {verdict.scoreBreakdown.map((b) => {
              const p = personaFor(b.specialist);
              return (
                <button
                  key={b.specialist}
                  onClick={() => onJump(b.specialist)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-panel px-4 py-2.5 text-left transition hover:bg-panel-2"
                >
                  <CallsignBadge callsign={p.callsign} color={p.color} />
                  <span className="mono w-24 shrink-0 text-sm tracking-wider" style={{ color: p.color }}>{p.label}</span>
                  <ChannelBar value={b.score} color={p.color} />
                  <span className="mono w-12 shrink-0 text-right text-sm font-medium">{b.score}/10</span>
                </button>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* conflicts */}
      {verdict.conflicts.length > 0 && (
        <motion.div {...reveal(2)}>
          <div className="rounded-lg border border-yellow-400/40 bg-yellow-400/5 p-5">
            <p className="mono mb-2 text-sm font-semibold tracking-wider text-yellow-400">⚠ TEAM CONFLICT</p>
            {verdict.conflicts.map((c, i) => (
              <div key={i} className="text-sm text-muted">
                <p>{c.a}</p>
                <p>{c.b}</p>
                <p className="mt-2 text-foreground">→ {c.resolution}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* prioritized fixes */}
      {verdict.fixList.length > 0 && (
        <motion.section {...reveal(3)}>
          <h2 className="mono mb-3 text-xs uppercase tracking-[0.2em] text-muted">prioritized fixes</h2>
          <ol className="space-y-2">
            {verdict.fixList.map((f, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3 text-sm">
                <span className="mono text-muted">{String(i + 1).padStart(2, "0")}</span>
                <SeverityTag severity={f.severity} />
                <span>{f.title}</span>
              </li>
            ))}
          </ol>
        </motion.section>
      )}

      {/* standby / didn't run */}
      {run.skipped.length > 0 && (
        <motion.div {...reveal(4)}>
          <DidntRun skipped={run.skipped} />
        </motion.div>
      )}
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
      <h2 className="mono mb-3 text-xs uppercase tracking-[0.2em] text-muted">standby · didn&apos;t run</h2>
      <div className="space-y-2">
        {groups.map(([spec, items]) => {
          const p = personaFor(spec);
          return (
            <div key={spec} className="flex items-center gap-2.5 rounded-lg border border-border bg-panel px-4 py-3 text-sm">
              <CallsignBadge callsign={p.callsign} color={p.color} />
              <span className="mono text-muted">
                {items.map((i) => i.skillId).join(", ")} · {items[0].reason}
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
      <Panel className="mb-5 p-5" active={list.some((s) => s.status === "running" || s.status === "pending")}>
        <div className="flex items-center gap-3">
          <CallsignBadge callsign={p.callsign} color={p.color} size="md" />
          <div>
            <div className="mono text-lg font-semibold tracking-wider" style={{ color: p.color }}>{p.label}</div>
            <div className="mono text-xs text-muted">{p.role}</div>
          </div>
          {avg != null && (
            <div className="mono ml-auto text-2xl font-semibold">
              {avg}
              <span className="text-sm text-muted">/10</span>
            </div>
          )}
        </div>
      </Panel>
      <div className="space-y-4">
        {list.map((s, i) => (
          <motion.div key={s.skillId} {...reveal(i)}>
            <SkillCard skill={s} color={p.color} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SkillCard({ skill, color }: { skill: SkillEnvelope; color: string }) {
  const working = skill.status === "running" || skill.status === "pending";
  return (
    <Panel className="p-5" active={working}>
      <div className="mb-3 flex items-center gap-2">
        <StatusLine label={skill.skillId} status={skill.status} />
        {skill.stance && skill.stance !== "n/a" && STANCE[skill.stance] && (
          <span className={`mono rounded border px-1.5 py-0.5 text-[11px] uppercase tracking-wider ${STANCE[skill.stance]}`}>
            {skill.stance}
          </span>
        )}
        {skill.score != null && (
          <span className="mono ml-auto text-lg font-semibold">
            {skill.score}
            <span className="text-xs text-muted">/10</span>
          </span>
        )}
      </div>
      {skill.note && <p className="mb-3 text-sm text-muted">{skill.note}</p>}
      {skill.findings.length > 0 ? (
        <ul className="space-y-3">
          {skill.findings.map((f, i) => (
            <li key={i} className="rounded-lg border border-border bg-panel-2 p-3">
              <div className="flex items-start gap-2">
                <SeverityTag severity={f.severity} />
                <span className="text-sm font-medium">{f.title}</span>
              </div>
              {f.evidence && <p className="mono mt-2 text-xs text-muted">{f.evidence}</p>}
              {f.fix && (
                <p className="mt-2 text-sm" style={{ color }}>
                  → {f.fix}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : working ? (
        <p className="mono text-sm text-accent cursor">scanning</p>
      ) : skill.status === "failed" ? (
        <p className="mono text-sm text-red-400">! errored{skill.note ? ` — ${skill.note}` : "."}</p>
      ) : (
        <p className="mono text-sm text-muted">no issues found.</p>
      )}
    </Panel>
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

  if (!ready) return <p className="mono text-sm text-muted">the investor enters once the verdict is in…</p>;

  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <CallsignBadge callsign="INV" color={p.color} size="md" />
        <span className="mono text-lg font-semibold tracking-wider" style={{ color: p.color }}>THE INVESTOR</span>
      </div>
      {turns.length === 0 ? (
        <button
          onClick={() => next()}
          disabled={busy}
          className="mono rounded-lg px-5 py-2.5 text-sm font-semibold tracking-wider text-background transition hover:opacity-90 disabled:opacity-40"
          style={{ background: p.color, boxShadow: `0 0 18px -4px ${p.color}` }}
        >
          {busy ? "…" : "FACE THE INVESTOR →"}
        </button>
      ) : (
        <div className="space-y-3">
          {turns.map((t, i) => (
            <p key={i} className={`text-sm ${t.who === "investor" ? "text-foreground" : "text-muted"}`}>
              <span className="mono mr-1.5" style={{ color: t.who === "investor" ? p.color : undefined }}>
                {t.who === "investor" ? "INV ›" : "YOU ›"}
              </span>
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
              placeholder="defend your product…"
              className="mono flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => {
                if (answer.trim()) {
                  next(answer.trim());
                  setAnswer("");
                }
              }}
              disabled={busy || !answer.trim()}
              className="mono rounded-lg px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-40"
              style={{ background: p.color }}
            >
              SEND
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
