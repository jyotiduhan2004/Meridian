"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/track";

type Extracted = { url?: string; repo?: string; description?: string };
type Mode = "product" | "idea";

export default function Intake() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("product");
  const [ex, setEx] = useState<Extracted | null>(null);
  const [busy, setBusy] = useState(false);

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
    trackEvent("analysis_started", { mode });
    const inputs =
      mode === "idea"
        ? { description: ex?.description }
        : {
            url: ex?.url || undefined,
            repo: ex?.repo || undefined,
            description: ex?.description || undefined,
          };
    const r = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inputs, mode }),
    });
    const d = await r.json();
    router.push(`/report/${d.runId}`);
  }

  return (
    <div className="w-full max-w-xl text-left">
      {/* mode toggle */}
      <div className="mb-3 flex gap-1 rounded-lg border border-border bg-panel p-1">
        {(["product", "idea"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`mono flex-1 rounded-md px-3 py-1.5 text-sm tracking-wider transition ${
              mode === m ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            [ {m === "product" ? "PRODUCT" : "IDEA"} ]
          </button>
        ))}
      </div>
      <p className="mono mb-3 text-center text-xs text-muted">
        {mode === "idea"
          ? "IDEA = concept → PRODUCT + MARKET only"
          : "PRODUCT = built → the full team (UX · QA · SEC · OPS · MKT · PM)"}
      </p>

      <div className="relative">
        <span className="mono pointer-events-none absolute left-4 top-4 text-accent">&gt;</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            mode === "idea"
              ? "describe your idea — the problem, who it's for, how it works…"
              : "paste a URL, a GitHub repo, a description — anything about your project…"
          }
          className="mono h-32 w-full resize-none rounded-lg border border-border bg-panel py-4 pl-8 pr-4 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      {!ex ? (
        <button
          onClick={analyze}
          disabled={busy || !text.trim()}
          className="mono mt-3 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold tracking-wider text-background transition hover:opacity-90 disabled:opacity-40"
          style={{ boxShadow: busy || !text.trim() ? undefined : "0 0 18px -4px var(--accent)" }}
        >
          {busy ? "READING…" : "ANALYZE ▸"}
        </button>
      ) : (
        <div className="mt-4 rounded-lg border border-border bg-panel p-4">
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
                className="mono w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </label>
          ))}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setEx(null)}
              className="mono rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              ← BACK
            </button>
            <button
              onClick={run}
              disabled={busy}
              className="mono flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold tracking-wider text-background transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "DEPLOYING TEAM…" : "RUN THE TEAM ▸"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
