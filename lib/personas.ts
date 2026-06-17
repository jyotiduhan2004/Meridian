// Display config for each specialist, keyed by the raw `specialist` value in SKILL.md.
// War-room identity: an uppercase role LABEL + a short monogram CALLSIGN, each in
// the specialist's signature channel color. No first names.

export type Persona = {
  /** uppercase role label shown in the UI, e.g. "SECURITY" */
  label: string;
  /** short monogram callsign for the badge, e.g. "SEC" */
  callsign: string;
  /** full role, used in the model system prompt, e.g. "Security Engineer" */
  role: string;
  /** sort order across the board */
  order: number;
  /** signature channel color (hex) for the badge, tab, score bar */
  color: string;
};

export const PERSONAS: Record<string, Persona> = {
  PM: { label: "PRODUCT", callsign: "PM", role: "Product Lead", order: 0, color: "#a78bfa" },
  "UX Designer": { label: "UX", callsign: "UX", role: "UX Designer", order: 1, color: "#f472b6" },
  "QA Engineer": { label: "QA", callsign: "QA", role: "QA Engineer", order: 2, color: "#2dd4bf" },
  "Market Researcher": { label: "MARKET", callsign: "MKT", role: "Market Researcher", order: 3, color: "#fbbf24" },
  "Security Engineer": { label: "SECURITY", callsign: "SEC", role: "Security Engineer", order: 4, color: "#f87171" },
  "DevOps Engineer": { label: "DEVOPS", callsign: "OPS", role: "DevOps Engineer", order: 5, color: "#38bdf8" },
  Investor: { label: "THE INVESTOR", callsign: "INV", role: "The Investor", order: 6, color: "#eab308" },
};

const FALLBACK: Persona = { label: "SPECIALIST", callsign: "•", role: "Specialist", order: 99, color: "#9aa3b2" };

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
