import { RunInputs, SkillEnvelope, Mode } from "@/lib/schema";

export type RunEvent = { t: number; type: string; skillId?: string };

export type Verdict = {
  meridianScore: number;
  scoreBreakdown: { specialist: string; score: number; weight: number }[];
  conflicts: { topic: string; a: string; b: string; resolution: string }[];
  fixList: { title: string; severity: string; skillId: string }[];
  verdict: "ship" | "ship-with-fixes" | "not-yet";
  note: string;
} | null;

export type Run = {
  id: string;
  mode: Mode;
  inputs: RunInputs;
  plan: string[]; // eligible fan-out skill ids
  skipped: { skillId: string; reason: string }[];
  skills: Record<string, SkillEnvelope>; // by skillId
  events: RunEvent[];
  verdict: Verdict;
  createdAt: number;
};

export interface RunStore {
  create(run: Run): void;
  get(id: string): Run | undefined;
  putSkill(id: string, env: SkillEnvelope): void;
  setVerdict(id: string, v: Verdict): void;
  addEvent(id: string, e: RunEvent): void;
}

// In-memory store. Persisted on globalThis so it survives Next dev HMR.
// (Swapped for a Supabase-backed store in production — see M5.)
class MemoryRunStore implements RunStore {
  private runs = new Map<string, Run>();
  create(run: Run) {
    this.runs.set(run.id, run);
  }
  get(id: string) {
    return this.runs.get(id);
  }
  putSkill(id: string, env: SkillEnvelope) {
    const r = this.runs.get(id);
    if (!r) return;
    r.skills[env.skillId] = env;
    r.events.push({ t: Date.now(), type: `skill.${env.status}`, skillId: env.skillId });
  }
  setVerdict(id: string, v: Verdict) {
    const r = this.runs.get(id);
    if (!r) return;
    r.verdict = v;
    r.events.push({ t: Date.now(), type: "verdict.ready" });
  }
  addEvent(id: string, e: RunEvent) {
    this.runs.get(id)?.events.push(e);
  }
}

const g = globalThis as unknown as { __meridianStore?: RunStore };
export const store: RunStore = g.__meridianStore ?? (g.__meridianStore = new MemoryRunStore());
