import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Meridian — your product team, on demand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card, generated at build/request time (no static asset).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#06080c",
          backgroundImage: "radial-gradient(60% 50% at 50% 0%, rgba(34,211,238,0.18), transparent 70%)",
          color: "#dfe6ef",
          fontFamily: "sans-serif",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, letterSpacing: 10, color: "#22d3ee" }}>
          ⊕ MERIDIAN
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 64, fontWeight: 700, maxWidth: 980, textAlign: "center", lineHeight: 1.1 }}>
          Find every flaw before your users — and investors — do.
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#8593a6", maxWidth: 820, textAlign: "center" }}>
          A team of specialist agents tears your product apart, then makes you defend it.
        </div>
      </div>
    ),
    { ...size },
  );
}
