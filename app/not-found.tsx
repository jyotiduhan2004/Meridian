import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <span className="mono inline-flex items-center gap-2 text-sm tracking-[0.28em] text-muted">
        <span className="text-accent glow">⊕</span> MERIDIAN
      </span>
      <h1 className="text-6xl font-bold text-gradient">404</h1>
      <p className="max-w-md text-muted">
        This page wandered off the map. Let&apos;s get you back to your product team.
      </p>
      <Link
        href="/"
        className="pill bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:brightness-110"
        style={{ boxShadow: "0 0 22px -6px var(--accent)" }}
      >
        ← Back to Meridian
      </Link>
    </main>
  );
}
