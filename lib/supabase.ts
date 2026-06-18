// Minimal Supabase access over PostgREST + fetch — no SDK dependency, so the
// Windows-native node_modules stay untouched. Server-only: it uses the service
// role key, which bypasses RLS, so these tables stay locked to anon clients.

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

export function supabaseConfigured(): boolean {
  return !!BASE && !!KEY && (process.env.STORE ?? "").toLowerCase() !== "memory";
}

const rest = (path: string) => `${BASE}/rest/v1/${path}`;
const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
});

/** Insert-or-update by conflict target (e.g. "id" or "run_id,skill_id"). */
export async function sbUpsert(table: string, rows: unknown, onConflict: string): Promise<void> {
  const res = await fetch(`${rest(table)}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`supabase upsert ${table} ${res.status}: ${await res.text()}`);
}

export async function sbInsert(table: string, rows: unknown): Promise<void> {
  const res = await fetch(rest(table), {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`supabase insert ${table} ${res.status}: ${await res.text()}`);
}

export async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${rest(table)}?${query}`, { headers: headers() });
  if (!res.ok) throw new Error(`supabase select ${table} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T[]>;
}
