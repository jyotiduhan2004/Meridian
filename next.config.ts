import type { NextConfig } from "next";

// Safe everywhere (never break functionality).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Pragmatic CSP — strict directives, but allows the inline theme/JSON-LD scripts,
// Tailwind/inline styles, self-hosted fonts, and the Pendo analytics agent. Applied
// only in production: dev/HMR uses eval, which a strict script-src would block.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://cdn.pendo.io https://*.pendo.io https://app.pendo.io",
  "connect-src 'self' https://*.pendo.io https://data.pendo.io",
].join("; ");

const nextConfig: NextConfig = {
  // Ensure the /skills/*/SKILL.md files are bundled into the serverless functions
  // (the skill registry reads them at runtime).
  outputFileTracingIncludes: {
    "/api/**/*": ["./skills/**/*"],
  },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy", value: csp });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
