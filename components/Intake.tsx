"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/track";
import { PERSONAS } from "@/lib/personas";

type Extracted = { url?: string; repo?: string; description?: string };
type Mode = "product" | "idea";

// [specialistKey, persona] for the six specialists (the investor isn't selectable).
const SPECIALISTS = Object.entries(PERSONAS)
  .filter(([, p]) => p.callsign !== "INV")
  .sort((a, b) => a[1].order - b[1].order);

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Intake() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("product");
  const [ex, setEx] = useState<Extracted | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [creds, setCreds] = useState({ email: "", password: "" });
  const [chosen, setChosen] = useState<Set<string>>(new Set(SPECIALISTS.map(([k]) => k)));

  function toggleSpecialist(key: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function analyze() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      setEx({ url: d.url ?? "", repo: d.repo ?? "", description: d.description ?? "" });
      setNeedsLogin(!!d.needsLogin);
      trackEvent("product_submitted", {
        mode,
        has_url: !!d.url,
        has_repo: !!d.repo,
        has_description: !!d.description,
      });
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    trackEvent("analysis_started", { mode, specialists: [...chosen].length });
    const inputs =
      mode === "idea"
        ? { description: ex?.description }
        : {
            url: ex?.url || undefined,
            repo: ex?.repo || undefined,
            description: ex?.description || undefined,
          };
    const credentials =
      needsLogin && creds.email && creds.password ? { email: creds.email, password: creds.password } : undefined;
    const r = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inputs, mode, specialists: [...chosen], credentials, needsLogin }),
    });
    const d = await r.json();
    router.push(`/report/${d.runId}`);
  }

  return (
    <div className="glass glow-cyan w-full rounded-[20px] p-5 text-left">
      {/* mode toggle */}
      <div className="mb-3 flex gap-1 rounded-full border border-border/70 bg-background/40 p-1">
        {(["product", "idea"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`pill flex-1 px-3 py-1.5 text-sm font-medium transition ${
              mode === m ? "bg-accent text-background" : "text-muted hover:text-foreground"
            }`}
            style={mode === m ? { boxShadow: "0 0 18px -6px var(--accent)" } : undefined}
          >
            {m === "product" ? "Product" : "Idea"}
          </button>
        ))}
      </div>
      <p className="mb-3 text-center text-xs text-muted">
        {mode === "idea"
          ? "Idea = concept → Product + Market specialists only"
          : "Product = built → the full team (UX · QA · SEC · OPS · MKT · PM)"}
      </p>

      <div className="relative">
        <span className="mono pointer-events-none absolute left-4 top-4 text-accent">&gt;</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            mode === "idea"
              ? "describe your idea — the problem, who it's for, how it works…"
              : "paste a URL, a GitHub repo, a Devpost link, or a description…"
          }
          className="mono h-32 w-full resize-none rounded-2xl border border-border bg-background/50 py-4 pl-8 pr-4 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      {!ex ? (
        <button
          onClick={analyze}
          disabled={busy || !text.trim()}
          className="pill mt-3 w-full bg-accent px-4 py-3 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-40"
          style={{ boxShadow: busy || !text.trim() ? undefined : "0 0 22px -6px var(--accent)" }}
        >
          {busy ? (
            <span className="inline-flex items-center justify-center gap-2"><Spinner /> Reading…</span>
          ) : (
            "Analyze →"
          )}
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
          <p className="mono mb-3 text-xs uppercase tracking-[0.2em] text-muted">detected — confirm or edit</p>
          {(["url", "repo", "description"] as const).map((k) => (
            <label key={k} className="mb-2 block">
              <span className="mono mb-1 block text-xs uppercase tracking-wider text-muted">
                {k}
                {mode === "idea" && k !== "description" ? " · ignored in idea mode" : ""}
              </span>
              <input
                value={ex[k] ?? ""}
                onChange={(e) => setEx({ ...ex, [k]: e.target.value })}
                placeholder={`no ${k} detected`}
                className="mono w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>
          ))}

          {/* login wall → optional credentials */}
          {needsLogin && mode === "product" && (
            <div className="mt-3 rounded-xl border border-yellow-400/40 bg-yellow-400/5 p-3">
              <p className="mb-2 text-xs text-yellow-400">
                ⚠ This URL needs a login. Add a (throwaway) test login so the team can see the real app —
                best-effort. Leave blank to skip the live-page review.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={creds.email}
                  onChange={(e) => setCreds({ ...creds, email: e.target.value })}
                  placeholder="login email"
                  autoComplete="off"
                  className="mono w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
                <input
                  value={creds.password}
                  onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                  placeholder="login password"
                  type="password"
                  autoComplete="off"
                  className="mono w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <p className="mt-2 text-[11px] text-muted">Used only for this run — never saved or stored.</p>
            </div>
          )}

          {/* specialist selection */}
          <div className="mt-4">
            <p className="mono mb-1 text-xs uppercase tracking-wider text-muted">specialists to run</p>
            <p className="mb-2 text-[11px] text-muted">
              Tap to include or exclude — deselected specialists are skipped and their weight is redistributed.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SPECIALISTS.map(([key, p]) => {
                const on = chosen.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSpecialist(key)}
                    className={`pill flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 text-xs transition hover:scale-105 ${
                      on ? "" : "opacity-55 hover:opacity-90"
                    }`}
                    style={{
                      borderColor: on ? `${p.color}88` : "var(--border)",
                      background: on ? `${p.color}1f` : "transparent",
                      color: on ? p.color : "var(--muted)",
                    }}
                  >
                    <span aria-hidden className="text-[10px] leading-none">{on ? "✓" : "+"}</span>
                    <span className="mono font-semibold">{p.callsign}</span>
                    <span className="mono tracking-wide">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setEx(null)}
              className="pill border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
            >
              ← Back
            </button>
            <button
              onClick={run}
              disabled={busy}
              className="pill flex-1 bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-40"
              style={{ boxShadow: busy ? undefined : "0 0 22px -6px var(--accent)" }}
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2"><Spinner /> Deploying team…</span>
              ) : (
                "Run the team →"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
