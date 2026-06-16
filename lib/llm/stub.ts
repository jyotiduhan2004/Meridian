import { LLMProvider, LLMRequest } from "./types";

// Canned analysis payloads per skill (the part a real model would produce).
// The runner wraps these into the full envelope (adds skillId/specialist/status).
type Analysis = {
  score: number;
  stance: string;
  rubricBreakdown: { dimension: string; max: number; earned: number }[];
  findings: {
    title: string;
    severity: string;
    evidence?: string;
    fix?: string;
    effort?: string;
  }[];
  note?: string;
};

const CANNED: Record<string, Analysis> = {
  "audit-visual-ux": {
    score: 7,
    stance: "ship",
    rubricBreakdown: [
      { dimension: "Visual hierarchy & layout", max: 3, earned: 2 },
      { dimension: "Responsiveness & touch", max: 2, earned: 1 },
      { dimension: "CTA & interaction states", max: 2, earned: 2 },
      { dimension: "Consistency & typography", max: 2, earned: 1 },
      { dimension: "Accessibility basics", max: 1, earned: 1 },
    ],
    findings: [
      {
        title: "Primary CTA contrast is too low",
        severity: "high",
        evidence: "hero section — grey CTA on a grey background",
        fix: "Raise CTA contrast to ≥ 4.5:1 and keep it above the fold",
        effort: "easy",
      },
      {
        title: "Mobile nav overlaps content below 380px",
        severity: "medium",
        evidence: "375px viewport",
        fix: "Collapse to a hamburger menu under 640px",
        effort: "medium",
      },
    ],
  },
  "walk-user-journey": {
    score: 5,
    stance: "fix-first",
    rubricBreakdown: [
      { dimension: "Signup success", max: 2, earned: 0 },
      { dimension: "Flow completability", max: 3, earned: 2 },
      { dimension: "Error handling", max: 2, earned: 1 },
      { dimension: "Onboarding clarity", max: 3, earned: 2 },
    ],
    findings: [
      {
        title: "Signup breaks at step 2 (empty email accepted, then 500)",
        severity: "critical",
        evidence: "signup form → submit",
        fix: "Validate email client + server side; handle the 500 gracefully",
        effort: "medium",
      },
    ],
    note: "ran in automation mode",
  },
  "review-code-quality": {
    score: 6,
    stance: "fix-first",
    rubricBreakdown: [
      { dimension: "Structure & architecture", max: 2, earned: 1 },
      { dimension: "Test coverage of risky paths", max: 2, earned: 1 },
      { dimension: "Code smells", max: 2, earned: 1 },
      { dimension: "Naming & consistency", max: 2, earned: 2 },
      { dimension: "Documentation", max: 2, earned: 1 },
    ],
    findings: [
      {
        title: "No tests around the payment path",
        severity: "high",
        evidence: "src/payments/*",
        fix: "Add unit tests for the charge + refund flows",
        effort: "medium",
      },
      {
        title: "Large component with deep nesting",
        severity: "low",
        evidence: "components/Dashboard.tsx (~480 lines)",
        fix: "Extract subcomponents; flatten nested conditionals",
        effort: "medium",
      },
    ],
  },
  "analyze-competitors": {
    score: 7,
    stance: "n/a",
    rubricBreakdown: [
      { dimension: "Differentiation clarity", max: 3, earned: 2 },
      { dimension: "Market gap identified", max: 3, earned: 2 },
      { dimension: "Competitor awareness", max: 2, earned: 2 },
      { dimension: "Timing / why now", max: 2, earned: 1 },
    ],
    findings: [
      {
        title: "Differentiation is real but under-stated",
        severity: "medium",
        evidence: "3 direct competitors share the same headline claim",
        fix: "Lead with the unique mechanism, not the category",
        effort: "easy",
      },
    ],
  },
  "size-market": {
    score: 6,
    stance: "n/a",
    rubricBreakdown: [
      { dimension: "Problem is real", max: 3, earned: 3 },
      { dimension: "Market size viable", max: 3, earned: 1 },
      { dimension: "Growth trajectory", max: 2, earned: 1 },
      { dimension: "Source / data quality", max: 2, earned: 1 },
    ],
    findings: [
      {
        title: "SOM looks small — the ICP is narrow",
        severity: "medium",
        evidence: "bottom-up: ~2k reachable paying teams in year one",
        fix: "Widen the beachhead or raise ACV",
        effort: "hard",
      },
    ],
    note: "directional estimate",
  },
  "scan-owasp": {
    score: 7,
    stance: "ship",
    rubricBreakdown: [
      { dimension: "No critical/high vulns", max: 4, earned: 3 },
      { dimension: "Secure headers + CORS", max: 3, earned: 2 },
      { dimension: "HTTPS + crypto hygiene", max: 3, earned: 2 },
    ],
    findings: [
      { title: "Missing Content-Security-Policy header", severity: "medium", evidence: "response headers", fix: "Add a CSP header", effort: "easy" },
    ],
  },
  "detect-secrets": {
    score: 3,
    stance: "block",
    rubricBreakdown: [
      { dimension: "No exposed secrets", max: 6, earned: 1 },
      { dimension: "No hardcoded credentials", max: 4, earned: 2 },
    ],
    findings: [
      { title: "AWS access key committed to the repo", severity: "critical", evidence: "src/config.ts:12", fix: "Rotate the key and purge it from git history", effort: "easy" },
    ],
  },
  "check-deps": {
    score: 6,
    stance: "fix-first",
    rubricBreakdown: [
      { dimension: "No high/critical CVEs", max: 6, earned: 3 },
      { dimension: "Maintained, current deps", max: 4, earned: 3 },
    ],
    findings: [
      { title: "Outdated dependency with a known high-severity advisory", severity: "high", evidence: "lockfile", fix: "Upgrade to the patched version", effort: "medium" },
    ],
  },
  "audit-api-auth": {
    score: 7,
    stance: "ship",
    rubricBreakdown: [
      { dimension: "Sensitive endpoints protected", max: 6, earned: 5 },
      { dimension: "No data leakage", max: 4, earned: 2 },
    ],
    findings: [
      { title: "Error responses leak a stack trace", severity: "medium", evidence: "GET /api/items (500)", fix: "Return a generic error; log details server-side", effort: "easy" },
    ],
  },
  "audit-performance": {
    score: 6,
    stance: "fix-first",
    rubricBreakdown: [
      { dimension: "LCP / FCP", max: 2, earned: 1 },
      { dimension: "INP / CLS", max: 2, earned: 1 },
      { dimension: "Bundle / JS weight", max: 2, earned: 1 },
      { dimension: "Image optimization", max: 2, earned: 1 },
      { dimension: "Caching / loading", max: 2, earned: 2 },
    ],
    findings: [
      { title: "Large unoptimized hero image hurts LCP", severity: "high", evidence: "hero.png ~1.4MB", fix: "Serve WebP/AVIF at the right size and preload it", effort: "medium" },
    ],
  },
  "estimate-scalability": {
    score: 6,
    stance: "n/a",
    note: "directional estimate",
    rubricBreakdown: [
      { dimension: "Architecture pattern", max: 2, earned: 1 },
      { dimension: "No obvious bottlenecks", max: 3, earned: 1 },
      { dimension: "Caching strategy", max: 2, earned: 1 },
      { dimension: "DB optimization", max: 3, earned: 3 },
    ],
    findings: [
      { title: "Likely fine to low-thousands of users; first bottleneck is an N+1 on the feed query", severity: "medium", evidence: "feed loads each item's author separately", fix: "Batch the query or add an index", effort: "medium" },
    ],
  },
  "check-launch-readiness": {
    score: 5,
    stance: "fix-first",
    rubricBreakdown: [
      { dimension: "Analytics", max: 2, earned: 0 },
      { dimension: "Error tracking", max: 1, earned: 0 },
      { dimension: "Legal pages + contact", max: 2, earned: 1 },
      { dimension: "Social / OG", max: 1, earned: 1 },
      { dimension: "Polish", max: 4, earned: 3 },
    ],
    findings: [
      { title: "No product analytics installed", severity: "medium", evidence: "no tracker found on the page", fix: "Install analytics to learn from real usage", effort: "easy" },
      { title: "No error tracking", severity: "medium", evidence: "no Sentry/equivalent", fix: "Add error tracking before launch", effort: "easy" },
    ],
  },
  "review-copy": {
    score: 7,
    stance: "ship",
    rubricBreakdown: [
      { dimension: "Value-prop clarity", max: 3, earned: 2 },
      { dimension: "CTA effectiveness", max: 2, earned: 1 },
      { dimension: "Jargon-free", max: 2, earned: 1 },
      { dimension: "Tone consistency", max: 1, earned: 1 },
      { dimension: "Emotional hook", max: 2, earned: 2 },
    ],
    findings: [
      { title: "Headline leans on jargon", severity: "medium", evidence: "the hero headline", fix: "Say plainly what the product does and for whom", effort: "easy" },
    ],
  },
  "check-api-health": {
    score: 7,
    stance: "ship",
    rubricBreakdown: [
      { dimension: "Zero broken links/routes", max: 3, earned: 2 },
      { dimension: "Response times", max: 3, earned: 2 },
      { dimension: "Proper error handling", max: 2, earned: 2 },
      { dimension: "No orphan/mixed routes", max: 2, earned: 1 },
    ],
    findings: [
      { title: "One broken link in the footer", severity: "low", evidence: "/pricing-old returns 404", fix: "Update or remove the link", effort: "easy" },
    ],
  },
  "assess-pricing": {
    score: 6,
    stance: "n/a",
    rubricBreakdown: [
      { dimension: "Tier clarity", max: 2, earned: 1 },
      { dimension: "Pricing psychology", max: 2, earned: 1 },
      { dimension: "Market alignment", max: 3, earned: 2 },
      { dimension: "Value communication", max: 3, earned: 2 },
    ],
    findings: [
      { title: "Value metric punishes success", severity: "medium", evidence: "per-API-call pricing", fix: "Price on a metric that scales with the customer's value, not their usage cost", effort: "medium" },
    ],
  },
  "check-discoverability": {
    score: 5,
    stance: "fix-first",
    rubricBreakdown: [
      { dimension: "Meta tags complete", max: 2, earned: 0 },
      { dimension: "OG / social preview", max: 2, earned: 0 },
      { dimension: "Heading structure", max: 2, earned: 2 },
      { dimension: "Sitemap / robots / canonical", max: 2, earned: 2 },
      { dimension: "Structured data", max: 2, earned: 1 },
    ],
    findings: [
      { title: "Missing meta description and Open Graph tags", severity: "high", evidence: "<head> has no description / OG tags", fix: "Add a meta description + OG/Twitter tags so search and shares render", effort: "easy" },
    ],
  },
  "assess-business-model": {
    score: 7,
    stance: "n/a",
    rubricBreakdown: [
      { dimension: "Revenue model clarity", max: 2, earned: 2 },
      { dimension: "Unit economics viable", max: 3, earned: 2 },
      { dimension: "Sustainability", max: 3, earned: 2 },
      { dimension: "Risk awareness", max: 2, earned: 1 },
    ],
    findings: [
      { title: "Customer-acquisition path is unclear", severity: "medium", evidence: "no stated channel", fix: "Name the first affordable channel and a rough CAC range", effort: "medium" },
    ],
  },
  "scope-mvp": {
    score: 7,
    stance: "n/a",
    rubricBreakdown: [
      { dimension: "Core identified", max: 3, earned: 3 },
      { dimension: "Cut list", max: 3, earned: 2 },
      { dimension: "Sequencing", max: 2, earned: 1 },
      { dimension: "Risk-first focus", max: 2, earned: 1 },
    ],
    findings: [
      { title: "v1 scope is broad", severity: "low", evidence: "5 features described as must-have", fix: "Ship the one core job first; defer the other four", effort: "medium" },
    ],
  },
};

const FALLBACK: Analysis = {
  score: 7,
  stance: "ship",
  rubricBreakdown: [{ dimension: "Overall", max: 10, earned: 7 }],
  findings: [
    {
      title: "Looks solid; minor improvements available",
      severity: "low",
      fix: "See detailed notes",
      effort: "easy",
    },
  ],
};

const INVESTOR_TURNS = [
  "Your team flagged real issues. So convince me: why does this win *now*, and why hasn't an incumbent just bolted it on?",
  "That's a trend, not a reason. What's the durable moat once a well-funded competitor copies the feature set?",
  "Walk me through the unit economics — when does CAC pay back, and is 3:1 LTV:CAC realistic for this segment?",
];

export const stubProvider: LLMProvider = {
  name: "stub",
  vision: true,
  async complete(req: LLMRequest): Promise<string> {
    // simulate a little work so the live dashboard feels real
    await new Promise((r) => setTimeout(r, 300 + Math.floor(req.prompt.length % 500)));

    if (req.meta?.kind === "investor") {
      const round = Number(req.meta?.round ?? 0);
      return INVESTOR_TURNS[round % INVESTOR_TURNS.length];
    }

    const skillId = req.meta?.skillId as string | undefined;
    if (req.json && skillId) {
      return JSON.stringify(CANNED[skillId] ?? FALLBACK);
    }
    return "Stub response.";
  },
};
