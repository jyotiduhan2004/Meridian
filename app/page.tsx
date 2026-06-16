"use client";

import { useState, useCallback, useRef } from "react";

const TEAM = [
  { emoji: "📋", role: "Product Lead" },
  { emoji: "🎨", role: "UX Designer" },
  { emoji: "🧪", role: "QA Engineer" },
  { emoji: "📊", role: "Market Researcher" },
  { emoji: "🔒", role: "Security Engineer" },
  { emoji: "⚙️", role: "DevOps Engineer" },
  { emoji: "🦈", role: "The Investor" },
];

// ---------------------------------------------------------------------------
// Pendo tracking helper — safe to call even if the Pendo agent isn't loaded
// ---------------------------------------------------------------------------
function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
) {
  try {
    if (typeof window !== "undefined" && window.pendo) {
      window.pendo.track(name, properties);
    }
  } catch {
    // Never let tracking break application flow
  }
}

// ---------------------------------------------------------------------------
// Module-level deduplication Sets — survive component remounts within a session
// so that milestone events fire exactly once per analysis run.
// ---------------------------------------------------------------------------
const trackedAnalysisStarts = new Set<string>();
const trackedAnalysisCompletions = new Set<string>();
const trackedSkillEvents = new Set<string>();
const trackedVerdicts = new Set<string>();
const trackedDebateCompletions = new Set<string>();

// ---------------------------------------------------------------------------
// Types for skill / analysis results that arrive from the API
// ---------------------------------------------------------------------------
interface SkillResult {
  name: string;
  specialist: string;
  tier: string;
  status: "completed" | "failed" | "skipped";
  score?: number;
  stance?: string;
  durationMs: number;
  findingCount?: number;
  errorType?: string;
  fallbackUsed?: boolean;
  partialOutput?: boolean;
  // Skill-specific fields
  mode?: string;
  stepsCompleted?: number;
  primaryFlowSuccess?: boolean;
  viewportsTested?: number;
  hasAccessibilityIssues?: boolean;
  severityBlockingCount?: number;
  severityImportantCount?: number;
  severityNitCount?: number;
  competitorCount?: number;
  battleCardCount?: number;
  gapsIdentifiedCount?: number;
  moatTypesFound?: number;
  differentiationClear?: boolean;
  sizingMethod?: string;
  problemValidated?: boolean;
  tamRangeLow?: number;
  tamRangeHigh?: number;
  icpDefined?: boolean;
}

interface VerdictData {
  meridianScore: number;
  verdict: string;
  conflictCount: number;
  fixListCount: number;
  specialistsReporting: number;
  specialistsSkipped: number;
  weightsRenormalized: boolean;
  durationMs: number;
  weakestThemes: string[];
}

interface DebateResult {
  founderReadinessScore: number;
  marketDefenseScore: number;
  techDefenseScore: number;
  businessDefenseScore: number;
  moatDefenseScore: number;
  roundsCompleted: number;
  totalDurationMs: number;
  topUnansweredQuestion: string;
}

type Phase =
  | "input"
  | "confirm"
  | "analyzing"
  | "results"
  | "debate"
  | "done";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Home() {
  // --- Flow state ---
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [extracted, setExtracted] = useState({
    url: "",
    repo: "",
    description: "",
  });
  const [userEdited, setUserEdited] = useState(false);
  const [analysisId, setAnalysisId] = useState("");
  const analysisStartTime = useRef(0);

  // --- Verdict state (populated when analysis finishes) ---
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null);

  // --- Debate state ---
  const [debateResponse, setDebateResponse] = useState("");
  const [currentTheme, setCurrentTheme] = useState("");
  const [currentRound, setCurrentRound] = useState(0);
  const challengeShownAt = useRef(0);

  // -----------------------------------------------------------------------
  // Event 1 — product_submitted
  // Fires when the user submits their raw input for analysis.
  // -----------------------------------------------------------------------
  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const hasUrl = /https?:\/\/\S+/.test(trimmed);
    const hasRepo = /github\.com\/\S+/.test(trimmed);
    const hasDescription = trimmed.length > 20;

    trackEvent("product_submitted", {
      input_type: hasUrl ? "url" : hasRepo ? "repo" : "description",
      has_url: hasUrl,
      has_repo: hasRepo,
      has_description: hasDescription,
      input_length: trimmed.length,
    });

    // Extract structured inputs from the raw text
    // TODO: replace with Smart Intake API call
    const urlMatch = trimmed.match(/(https?:\/\/\S+)/);
    const repoMatch = trimmed.match(/github\.com\/([^\s/]+\/[^\s/]+)/);
    setExtracted({
      url: urlMatch?.[1] ?? "",
      repo: repoMatch?.[1] ?? "",
      description: trimmed,
    });
    setUserEdited(false);
    setPhase("confirm");
  }, [input]);

  // -----------------------------------------------------------------------
  // Event 2 — intake_confirmed  +  Event 3 — analysis_started
  // Fires when the user confirms the extracted inputs, then immediately
  // kicks off the analysis pipeline.
  // -----------------------------------------------------------------------
  const handleConfirm = useCallback(() => {
    const inputCount = [extracted.url, extracted.repo, extracted.description]
      .filter(Boolean).length;

    trackEvent("intake_confirmed", {
      confirmed_url: Boolean(extracted.url),
      confirmed_repo: Boolean(extracted.repo),
      confirmed_description: Boolean(extracted.description),
      extracted_input_count: inputCount,
      user_edited_extraction: userEdited,
    });

    // Generate an ID for this analysis run
    const id = crypto.randomUUID();
    setAnalysisId(id);
    analysisStartTime.current = Date.now();

    // Event 3 — analysis_started (deduplicated by analysis run ID)
    if (!trackedAnalysisStarts.has(id)) {
      trackedAnalysisStarts.add(id);

      const eligible: string[] = [];
      if (extracted.url) eligible.push("audit-visual-ux", "walk-user-journey");
      if (extracted.repo) eligible.push("review-code-quality");
      if (extracted.description || extracted.url)
        eligible.push("analyze-competitors");
      if (extracted.description) eligible.push("size-market");
      eligible.push("synthesize-verdict");

      trackEvent("analysis_started", {
        eligible_skill_count: eligible.length,
        eligible_skills: eligible.join(","),
        input_types: [
          extracted.url && "url",
          extracted.repo && "repo",
          extracted.description && "description",
        ]
          .filter(Boolean)
          .join(","),
        has_url: Boolean(extracted.url),
        has_repo: Boolean(extracted.repo),
        has_description: Boolean(extracted.description),
      });
    }

    setPhase("analyzing");
    // TODO: call analysis orchestrator API, then feed results to
    //       processSkillResult → onAnalysisCompleted → onVerdictSynthesized
  }, [extracted, userEdited]);

  // -----------------------------------------------------------------------
  // Events 5-11 — skill_completed / skill_failed + per-skill events
  // Called once per skill when its result arrives from the orchestrator.
  // -----------------------------------------------------------------------
  const processSkillResult = useCallback(
    (runId: string, result: SkillResult) => {
      const dedupKey = `${runId}:${result.name}`;
      if (trackedSkillEvents.has(dedupKey)) return;
      trackedSkillEvents.add(dedupKey);

      if (result.status === "failed") {
        // Event 6 — skill_failed
        trackEvent("skill_failed", {
          skill_name: result.name,
          specialist: result.specialist,
          error_type: result.errorType ?? "unknown",
          fallback_used: result.fallbackUsed ?? false,
          partial_output_returned: result.partialOutput ?? false,
          duration_ms: result.durationMs,
        });
        return;
      }

      if (result.status !== "completed") return;

      // Event 5 — skill_completed (generic)
      trackEvent("skill_completed", {
        skill_name: result.name,
        specialist: result.specialist,
        score: result.score ?? 0,
        stance: result.stance ?? "",
        duration_ms: result.durationMs,
        finding_count: result.findingCount ?? 0,
        tier: result.tier,
      });

      // Per-skill events (7-11)
      switch (result.name) {
        case "audit-visual-ux":
          trackEvent("ux_audit_completed", {
            score: result.score ?? 0,
            finding_count: result.findingCount ?? 0,
            stance: result.stance ?? "",
            viewports_tested: result.viewportsTested ?? 0,
            has_accessibility_issues:
              result.hasAccessibilityIssues ?? false,
            severity_blocking_count:
              result.severityBlockingCount ?? 0,
            severity_important_count:
              result.severityImportantCount ?? 0,
            duration_ms: result.durationMs,
          });
          break;
        case "walk-user-journey":
          trackEvent("user_journey_completed", {
            score: result.score ?? 0,
            mode: result.mode ?? "automation",
            stance: result.stance ?? "",
            steps_completed: result.stepsCompleted ?? 0,
            finding_count: result.findingCount ?? 0,
            primary_flow_success: result.primaryFlowSuccess ?? false,
            severity_blocking_count:
              result.severityBlockingCount ?? 0,
            duration_ms: result.durationMs,
          });
          break;
        case "review-code-quality":
          trackEvent("code_review_completed", {
            score: result.score ?? 0,
            stance: result.stance ?? "",
            finding_count: result.findingCount ?? 0,
            severity_blocking_count:
              result.severityBlockingCount ?? 0,
            severity_important_count:
              result.severityImportantCount ?? 0,
            severity_nit_count: result.severityNitCount ?? 0,
            duration_ms: result.durationMs,
          });
          break;
        case "analyze-competitors":
          trackEvent("competitor_analysis_completed", {
            score: result.score ?? 0,
            stance: result.stance ?? "",
            competitor_count: result.competitorCount ?? 0,
            battle_card_count: result.battleCardCount ?? 0,
            gaps_identified_count:
              result.gapsIdentifiedCount ?? 0,
            moat_types_found: result.moatTypesFound ?? 0,
            differentiation_clear:
              result.differentiationClear ?? false,
            duration_ms: result.durationMs,
          });
          break;
        case "size-market":
          trackEvent("market_sizing_completed", {
            score: result.score ?? 0,
            stance: result.stance ?? "",
            sizing_method: result.sizingMethod ?? "",
            problem_validated: result.problemValidated ?? false,
            tam_range_low: result.tamRangeLow ?? 0,
            tam_range_high: result.tamRangeHigh ?? 0,
            icp_defined: result.icpDefined ?? false,
            duration_ms: result.durationMs,
          });
          break;
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Event 4 — analysis_completed
  // Called once when every skill has finished (completed, failed, or skipped).
  // -----------------------------------------------------------------------
  const onAnalysisCompleted = useCallback(
    (runId: string, results: SkillResult[]) => {
      if (trackedAnalysisCompletions.has(runId)) return;
      trackedAnalysisCompletions.add(runId);

      const completed = results.filter((r) => r.status === "completed");
      const failed = results.filter((r) => r.status === "failed");
      const skipped = results.filter((r) => r.status === "skipped");

      trackEvent("analysis_completed", {
        total_duration_ms: Date.now() - analysisStartTime.current,
        skills_completed: completed.length,
        skills_failed: failed.length,
        skills_skipped: skipped.length,
        skill_names_completed: completed.map((r) => r.name).join(","),
        skill_names_failed: failed.map((r) => r.name).join(","),
        skill_names_skipped: skipped.map((r) => r.name).join(","),
      });

      setPhase("results");
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Event 12 — verdict_synthesized
  // Called when the Product Lead synthesises the final verdict.
  // -----------------------------------------------------------------------
  const onVerdictSynthesized = useCallback(
    (runId: string, verdict: VerdictData) => {
      if (trackedVerdicts.has(runId)) return;
      trackedVerdicts.add(runId);

      trackEvent("verdict_synthesized", {
        meridian_score: verdict.meridianScore,
        verdict: verdict.verdict,
        conflict_count: verdict.conflictCount,
        fix_list_count: verdict.fixListCount,
        specialists_reporting: verdict.specialistsReporting,
        specialists_skipped: verdict.specialistsSkipped,
        weights_renormalized: verdict.weightsRenormalized,
        duration_ms: verdict.durationMs,
      });

      setVerdictData(verdict);
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Event 13 — debate_started
  // Fires when the user clicks "Start Investor Debate".
  // -----------------------------------------------------------------------
  const handleStartDebate = useCallback(() => {
    if (!verdictData) return;

    trackEvent("debate_started", {
      meridian_score: verdictData.meridianScore,
      weakest_themes: verdictData.weakestThemes.join(","),
      verdict: verdictData.verdict,
    });

    setCurrentTheme(verdictData.weakestThemes[0] ?? "market");
    setCurrentRound(1);
    challengeShownAt.current = Date.now();
    setPhase("debate");
    // TODO: send opening challenge to investor agent
  }, [verdictData]);

  // -----------------------------------------------------------------------
  // Event 14 — founder_response_submitted
  // Fires each time the founder submits a defence during the debate.
  // -----------------------------------------------------------------------
  const handleSubmitResponse = useCallback(() => {
    const trimmed = debateResponse.trim();
    if (!trimmed) return;

    trackEvent("founder_response_submitted", {
      theme: currentTheme,
      round_number: currentRound,
      response_length: trimmed.length,
      response_time_ms: Date.now() - challengeShownAt.current,
    });

    setDebateResponse("");
    challengeShownAt.current = Date.now();
    // TODO: send response to investor agent, receive next challenge,
    //       advance round/theme, and eventually call onDebateCompleted
  }, [debateResponse, currentTheme, currentRound]);

  // -----------------------------------------------------------------------
  // Event 15 — debate_completed
  // Called when all debate themes are exhausted.
  // -----------------------------------------------------------------------
  const onDebateCompleted = useCallback(
    (debateId: string, result: DebateResult) => {
      if (trackedDebateCompletions.has(debateId)) return;
      trackedDebateCompletions.add(debateId);

      trackEvent("debate_completed", {
        founder_readiness_score: result.founderReadinessScore,
        market_defense_score: result.marketDefenseScore,
        tech_defense_score: result.techDefenseScore,
        business_defense_score: result.businessDefenseScore,
        moat_defense_score: result.moatDefenseScore,
        rounds_completed: result.roundsCompleted,
        total_duration_ms: result.totalDurationMs,
        top_unanswered_question:
          (result.topUnansweredQuestion ?? "").substring(0, 100),
      });

      setPhase("done");
    },
    [],
  );

  // Keep callback references available for API integration
  // (prevents "unused variable" warnings while the API isn't wired yet)
  const _callbacks = {
    processSkillResult,
    onAnalysisCompleted,
    onVerdictSynthesized,
    onDebateCompleted,
  };
  void _callbacks;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-6 text-xs uppercase tracking-[0.3em] text-muted">
        Meridian
      </span>

      <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
        Find every flaw before your users — and investors — do.
      </h1>

      <p className="mt-5 max-w-xl text-lg text-muted">
        Paste your product. A team of specialist agents tears it apart in
        parallel — then makes you defend it.
      </p>

      <div className="mt-10 flex max-w-2xl flex-wrap justify-center gap-2">
        {TEAM.map((t) => (
          <span
            key={t.role}
            className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted"
          >
            <span className="mr-1">{t.emoji}</span>
            {t.role}
          </span>
        ))}
      </div>

      {/* ---- Phase: input ---- */}
      {phase === "input" && (
        <div className="mt-12 w-full max-w-xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a URL, a GitHub repo, a description — anything about your project…"
            className="h-32 w-full resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="mt-3 rounded-lg bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Analyze
          </button>
        </div>
      )}

      {/* ---- Phase: confirm ---- */}
      {phase === "confirm" && (
        <div className="mt-12 w-full max-w-xl text-left">
          <h2 className="mb-4 text-lg font-medium">
            Confirm extracted inputs
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase text-muted">URL</label>
              <input
                type="text"
                value={extracted.url}
                onChange={(e) => {
                  setExtracted((p) => ({ ...p, url: e.target.value }));
                  setUserEdited(true);
                }}
                className="w-full rounded-lg border border-border bg-card p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase text-muted">Repo</label>
              <input
                type="text"
                value={extracted.repo}
                onChange={(e) => {
                  setExtracted((p) => ({ ...p, repo: e.target.value }));
                  setUserEdited(true);
                }}
                className="w-full rounded-lg border border-border bg-card p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase text-muted">
                Description
              </label>
              <textarea
                value={extracted.description}
                onChange={(e) => {
                  setExtracted((p) => ({
                    ...p,
                    description: e.target.value,
                  }));
                  setUserEdited(true);
                }}
                className="h-20 w-full resize-none rounded-lg border border-border bg-card p-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setPhase("input")}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="rounded-lg bg-foreground px-6 py-2 text-sm font-medium text-background"
            >
              Confirm &amp; Analyze
            </button>
          </div>
        </div>
      )}

      {/* ---- Phase: analyzing ---- */}
      {phase === "analyzing" && (
        <div className="mt-12 w-full max-w-xl">
          <p className="text-sm text-muted">
            Analysis in progress — specialist agents are running…
          </p>
          {/* TODO: render real-time skill progress from the orchestrator.
              As each skill result arrives, call processSkillResult(analysisId, result).
              When all skills finish, call onAnalysisCompleted(analysisId, allResults).
              When the verdict is ready, call onVerdictSynthesized(analysisId, verdict). */}
        </div>
      )}

      {/* ---- Phase: results ---- */}
      {phase === "results" && (
        <div className="mt-12 w-full max-w-xl">
          {verdictData && (
            <p className="mb-4 text-lg font-medium">
              Meridian Score: {verdictData.meridianScore}/100 —{" "}
              {verdictData.verdict}
            </p>
          )}
          <button
            onClick={handleStartDebate}
            disabled={!verdictData}
            className="rounded-lg bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Start Investor Debate
          </button>
        </div>
      )}

      {/* ---- Phase: debate ---- */}
      {phase === "debate" && (
        <div className="mt-12 w-full max-w-xl text-left">
          <h2 className="mb-2 text-lg font-medium">Investor Debate</h2>
          <p className="mb-4 text-xs uppercase text-muted">
            Theme: {currentTheme} · Round {currentRound}
          </p>
          {/* TODO: render the investor's current challenge here */}
          <textarea
            value={debateResponse}
            onChange={(e) => setDebateResponse(e.target.value)}
            placeholder="Defend your product…"
            className="h-24 w-full resize-none rounded-lg border border-border bg-card p-3 text-sm"
          />
          <button
            onClick={handleSubmitResponse}
            disabled={!debateResponse.trim()}
            className="mt-3 rounded-lg bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Submit Response
          </button>
        </div>
      )}

      {/* ---- Phase: done ---- */}
      {phase === "done" && (
        <div className="mt-12 w-full max-w-xl">
          <p className="text-sm text-muted">
            Analysis and debate complete.
          </p>
          {/* TODO: render final Meridian Score + Founder Readiness Score */}
        </div>
      )}
    </main>
  );
}
