import { RunInputs, SkillEnvelope, Mode } from "@/lib/schema";
import { supabaseConfigured, sbUpsert, sbUpdate, sbInsert, sbSelect } from "@/lib/supabase";

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
  skipped: { skillId: string; specialist: string; reason: string }[];
  skills: Record<string, SkillEnvelope>; // by skillId
  events: RunEvent[];
  verdict: Verdict;
  createdAt: number;
};

export interface RunStore {
  create(run: Run): Promise<void>;
  get(id: string): Promise<Run | undefined>;
  putSkill(id: string, env: SkillEnvelope): Promise<void>;
  setVerdict(id: string, v: Verdict): Promise<void>;
  addEvent(id: string, e: RunEvent): Promise<void>;
}

// In-memory store. Persisted on globalThis so it survives Next dev HMR, and used
// both standalone (no Supabase) and as the write-through cache below.
class MemoryRunStore implements RunStore {
  private runs = new Map<string, Run>();
  async create(run: Run) {
    this.runs.set(run.id, run);
  }
  async get(id: string) {
    return this.runs.get(id);
  }
  async putSkill(id: string, env: SkillEnvelope) {
    const r = this.runs.get(id);
    if (!r) return;
    r.skills[env.skillId] = env;
    r.events.push({ t: Date.now(), type: `skill.${env.status}`, skillId: env.skillId });
  }
  async setVerdict(id: string, v: Verdict) {
    const r = this.runs.get(id);
    if (!r) return;
    r.verdict = v;
    r.events.push({ t: Date.now(), type: "verdict.ready" });
  }
  async addEvent(id: string, e: RunEvent) {
    this.runs.get(id)?.events.push(e);
  }
  // local-only helper for the Supabase store's reconstruction cache
  seed(run: Run) {
    this.runs.set(run.id, run);
  }
}

// Best-effort: remote durability must never break a live (in-process) run.
async function safe(label: string, p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch (e) {
    console.warn(`[store] ${label} failed (continuing on in-memory):`, String(e).slice(0, 160));
  }
}

type RunRow = {
  id: string;
  mode: Mode;
  inputs: RunInputs;
  plan: string[];
  skipped: Run["skipped"];
  verdict: Verdict;
  created_at: number;
};

/**
 * Supabase-backed store. Writes through to Postgres (durable across serverless
 * invocations / restarts) while keeping the in-memory store as a hot cache and
 * a fallback if a remote call fails. Skills + events live in their own tables so
 * the concurrent per-skill writes upsert independently instead of clobbering one
 * shared JSON blob. Schema: supabase/schema.sql.
 */
class SupabaseRunStore implements RunStore {
  private mem = new MemoryRunStore();

  async create(run: Run) {
    await this.mem.create(run);
    await safe(
      "create",
      (async () => {
        await sbUpsert(
          "runs",
          {
            id: run.id,
            mode: run.mode,
            inputs: run.inputs,
            plan: run.plan,
            skipped: run.skipped,
            verdict: run.verdict,
            created_at: run.createdAt,
          },
          "id",
        );
        const skillRows = Object.values(run.skills).map((e) => ({
          run_id: run.id,
          skill_id: e.skillId,
          envelope: e,
          updated_at: run.createdAt,
        }));
        if (skillRows.length) await sbUpsert("run_skills", skillRows, "run_id,skill_id");
        if (run.events.length)
          await sbInsert(
            "run_events",
            run.events.map((ev) => ({
              run_id: run.id,
              t: ev.t,
              type: ev.type,
              skill_id: ev.skillId ?? null,
            })),
          );
      })(),
    );
  }

  async get(id: string): Promise<Run | undefined> {
    const local = await this.mem.get(id);
    if (local) return local;
    try {
      const rows = await sbSelect<RunRow>("runs", `id=eq.${id}&select=*`);
      if (!rows.length) return undefined;
      const r = rows[0];
      const skillRows = await sbSelect<{ skill_id: string; envelope: SkillEnvelope }>(
        "run_skills",
        `run_id=eq.${id}&select=skill_id,envelope`,
      );
      const eventRows = await sbSelect<{ t: number; type: string; skill_id: string | null }>(
        "run_events",
        `run_id=eq.${id}&select=t,type,skill_id&order=t.asc`,
      );
      const skills: Record<string, SkillEnvelope> = {};
      for (const s of skillRows) skills[s.skill_id] = s.envelope;
      const run: Run = {
        id: r.id,
        mode: r.mode,
        inputs: r.inputs,
        plan: r.plan ?? [],
        skipped: r.skipped ?? [],
        skills,
        events: eventRows.map((e) => ({
          t: Number(e.t),
          type: e.type,
          skillId: e.skill_id ?? undefined,
        })),
        verdict: r.verdict ?? null,
        createdAt: Number(r.created_at),
      };
      this.mem.seed(run); // hot-cache the reconstructed run for this process
      return run;
    } catch (e) {
      console.warn(`[store] get(${id}) remote failed:`, String(e).slice(0, 160));
      return undefined;
    }
  }

  async putSkill(id: string, env: SkillEnvelope) {
    await this.mem.putSkill(id, env);
    const t = Date.now();
    await safe(
      "putSkill",
      Promise.all([
        sbUpsert(
          "run_skills",
          { run_id: id, skill_id: env.skillId, envelope: env, updated_at: t },
          "run_id,skill_id",
        ),
        sbInsert("run_events", { run_id: id, t, type: `skill.${env.status}`, skill_id: env.skillId }),
      ]),
    );
  }

  async setVerdict(id: string, v: Verdict) {
    await this.mem.setVerdict(id, v);
    const t = Date.now();
    await safe(
      "setVerdict",
      Promise.all([
        sbUpdate("runs", `id=eq.${id}`, { verdict: v }),
        sbInsert("run_events", { run_id: id, t, type: "verdict.ready", skill_id: null }),
      ]),
    );
  }

  async addEvent(id: string, e: RunEvent) {
    await this.mem.addEvent(id, e);
    await safe(
      "addEvent",
      sbInsert("run_events", { run_id: id, t: e.t, type: e.type, skill_id: e.skillId ?? null }),
    );
  }
}

const g = globalThis as unknown as { __meridianStore?: RunStore };
export const store: RunStore =
  g.__meridianStore ??
  (g.__meridianStore = supabaseConfigured() ? new SupabaseRunStore() : new MemoryRunStore());
