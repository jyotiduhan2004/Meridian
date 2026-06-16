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
