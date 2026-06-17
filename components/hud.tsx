"use client";

import { useEffect, useState } from "react";
import { animate } from "motion/react";

// ── Shared HUD primitives for the war-room UI ──────────────────────────────

export const SEV_CLASS: Record<string, string> = {
  critical: "text-red-400 border-red-400/40 bg-red-400/10",
  high: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  medium: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  low: "text-sky-400 border-sky-400/40 bg-sky-400/10",
  nit: "text-muted border-border bg-panel-2",
};

export function SeverityTag({ severity }: { severity: string }) {
  return (
    <span
      className={`mono rounded-[3px] border px-1.5 py-0.5 text-[11px] uppercase tracking-wider ${
        SEV_CLASS[severity] ?? SEV_CLASS.nit
      }`}
    >
      {severity}
    </span>
  );
}

export function CallsignBadge({
  callsign,
  color,
  active = false,
  size = "sm",
}: {
  callsign: string;
  color: string;
  active?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`mono inline-flex items-center justify-center rounded-[4px] border font-semibold tracking-wider ${
        size === "md" ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-xs"
      }`}
      style={{
        color,
        borderColor: `${color}66`,
        background: `${color}14`,
        boxShadow: active ? `0 0 14px -2px ${color}` : undefined,
      }}
    >
      {callsign}
    </span>
  );
}

export function Panel({
  children,
  active = false,
  className = "",
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border bg-panel panel-glow ${
        active ? "scanline" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function ScoreRing({
  score,
  color = "var(--accent)",
  size = 72,
}: {
  score: number;
  color?: string;
  size?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const controls = animate(0, score, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [score]);
  const deg = val * 3.6;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${deg}deg, var(--border) 0)`,
          boxShadow: `0 0 20px -6px ${color}`,
        }}
      />
      <div
        className="mono absolute inset-[3px] flex items-center justify-center rounded-full bg-background font-semibold"
        style={{ fontSize: size * 0.3, color }}
      >
        {Math.round(val)}
      </div>
    </div>
  );
}

export function ChannelBar({ value, color }: { value: number; color: string }) {
  // value 0..10
  const [w, setW] = useState(0);
  useEffect(() => {
    const c = animate(0, value * 10, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setW(v) });
    return () => c.stop();
  }, [value]);
  return (
    <span className="relative block h-2 flex-1 overflow-hidden rounded-full bg-background">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${w}%`, background: color, boxShadow: `0 0 10px -2px ${color}` }}
      />
    </span>
  );
}

// "> scan <label> ........ done" — the live readout line.
export function StatusLine({ label, status }: { label: string; status: string }) {
  const dotCount = Math.max(2, 26 - label.length);
  const tag =
    status === "done" || status === "partial"
      ? "done"
      : status === "failed"
        ? "ERR"
        : status === "running" || status === "pending"
          ? "scanning"
          : status;
  const tagClass =
    status === "done" || status === "partial"
      ? "text-emerald-400"
      : status === "failed"
        ? "text-red-400"
        : "text-accent";
  return (
    <div className="mono text-xs">
      <span className="text-accent">&gt;</span>{" "}
      <span className="text-muted">scan {label}</span>{" "}
      <span className="text-border">{".".repeat(dotCount)}</span>{" "}
      <span className={tagClass}>{tag}</span>
    </div>
  );
}
