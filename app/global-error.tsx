"use client";

import { useEffect } from "react";

// Catches errors in the root layout itself — must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[meridian] global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#06080c",
          color: "#dfe6ef",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#8593a6", maxWidth: 420 }}>An unexpected error occurred. Please try again.</p>
        <button
          onClick={reset}
          style={{
            borderRadius: 999,
            background: "#22d3ee",
            color: "#06080c",
            border: "none",
            padding: "10px 20px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
