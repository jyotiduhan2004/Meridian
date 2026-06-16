// Display config for each specialist, keyed by the raw `specialist` value in SKILL.md.
// Persona names are drafts and can be renamed freely.

export type Persona = {
  /** persona name shown in the UI */
  persona: string;
  /** role label */
  display: string;
  emoji: string;
  /** sort order on the dashboard */
  order: number;
};

export const PERSONAS: Record<string, Persona> = {
  PM: { persona: "Priya", display: "Product Lead", emoji: "📋", order: 0 },
  "UX Designer": { persona: "Leo", display: "UX Designer", emoji: "🎨", order: 1 },
  "QA Engineer": { persona: "Sam", display: "QA Engineer", emoji: "🧪", order: 2 },
  "Market Researcher": { persona: "Dana", display: "Market Researcher", emoji: "📊", order: 3 },
  "Security Engineer": { persona: "Maya", display: "Security Engineer", emoji: "🔒", order: 4 },
  "DevOps Engineer": { persona: "Dev", display: "DevOps Engineer", emoji: "⚙️", order: 5 },
  Investor: { persona: "Victoria", display: "The Investor", emoji: "🦈", order: 6 },
};

const FALLBACK: Persona = { persona: "—", display: "Specialist", emoji: "•", order: 99 };

export function personaFor(specialist: string): Persona {
  return PERSONAS[specialist] ?? FALLBACK;
}

// Default weight per specialist for the Meridian Score (renormalized on skip/fail).
export const SPECIALIST_WEIGHTS: Record<string, number> = {
  "UX Designer": 18,
  "QA Engineer": 20,
  "Market Researcher": 18,
  "Security Engineer": 16,
  "DevOps Engineer": 14,
  PM: 14,
};
