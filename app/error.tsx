"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error (a real error-tracking sink would report it here).
    console.error("[meridian] route error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <span className="mono inline-flex items-center gap-2 text-sm tracking-[0.28em] text-muted">
        <span className="text-accent glow">⊕</span> MERIDIAN
      </span>
      <h1 className="text-3xl font-bold">Something broke on our end</h1>
      <p className="max-w-md text-muted">An unexpected error occurred. You can retry, or head back home.</p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="pill bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:brightness-110"
        >
          Try again
        </button>
        <Link
          href="/"
          className="pill border border-border px-5 py-2.5 text-sm text-muted transition hover:text-foreground"
        >
          ← Home
        </Link>
      </div>
    </main>
  );
}
