-- Meridian run persistence. Run once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Skills and events live in their own tables so the per-skill writes that fan
-- out concurrently upsert independently instead of clobbering one shared blob.
-- The server talks to these tables only with the service-role key, which
-- bypasses RLS; RLS is enabled with no policies so the public anon key cannot
-- read or write them.

create table if not exists runs (
  id          uuid primary key,
  mode        text   not null,
  inputs      jsonb  not null default '{}'::jsonb,
  plan        jsonb  not null default '[]'::jsonb,
  skipped     jsonb  not null default '[]'::jsonb,
  verdict     jsonb,
  created_at  bigint not null
);

create table if not exists run_skills (
  run_id     uuid   not null references runs(id) on delete cascade,
  skill_id   text   not null,
  envelope   jsonb  not null,
  updated_at bigint not null,
  primary key (run_id, skill_id)
);

create table if not exists run_events (
  id       bigserial primary key,
  run_id   uuid   not null references runs(id) on delete cascade,
  t        bigint not null,
  type     text   not null,
  skill_id text
);

create index if not exists run_events_run_idx on run_events (run_id, t);

-- Lock the tables to server-side (service-role) access only.
alter table runs       enable row level security;
alter table run_skills enable row level security;
alter table run_events enable row level security;
