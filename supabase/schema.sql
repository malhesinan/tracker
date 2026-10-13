-- ============================================================================
-- Workout Tracker — Supabase schema
-- ----------------------------------------------------------------------------
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- The app syncs whole records (a programme, a custom exercise, a workout
-- session, the settings profile) as JSON documents. Row Level Security limits
-- every row to the signed-in user who owns it.
-- The views at the bottom flatten the documents into ordinary tables for
-- querying in the dashboard or any SQL tool.
-- ============================================================================

create table if not exists public.records (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('program', 'exercise', 'session', 'profile')),
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

-- The server clock decides updated_at, so devices with a wrong clock still sync.
create or replace function public.records_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.records_touch();

alter table public.records enable row level security;

drop policy if exists "own rows: select" on public.records;
drop policy if exists "own rows: insert" on public.records;
drop policy if exists "own rows: update" on public.records;
drop policy if exists "own rows: delete" on public.records;

create policy "own rows: select" on public.records
  for select to authenticated using (user_id = auth.uid());
create policy "own rows: insert" on public.records
  for insert to authenticated with check (user_id = auth.uid());
create policy "own rows: update" on public.records
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows: delete" on public.records
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Read-only views. security_invoker makes them obey the RLS policies above.
-- ---------------------------------------------------------------------------

create or replace view public.workout_sessions with (security_invoker = true) as
select
  r.user_id,
  r.id                                                       as session_id,
  r.data ->> 'programName'                                   as program_name,
  r.data ->> 'dayName'                                       as day_name,
  r.data ->> 'status'                                        as status,
  to_timestamp((r.data ->> 'startedAt')::bigint / 1000.0)    as started_at,
  to_timestamp(nullif(r.data ->> 'endedAt', '')::bigint / 1000.0) as ended_at,
  nullif(r.data ->> 'rpe', '')::numeric                      as difficulty,
  nullif(r.data ->> 'energy', '')::numeric                   as energy,
  r.data ->> 'notes'                                         as notes
from public.records r
where r.kind = 'session' and not r.deleted;

create or replace view public.workout_sets with (security_invoker = true) as
select
  r.user_id,
  r.id                                                       as session_id,
  to_timestamp((r.data ->> 'startedAt')::bigint / 1000.0)    as session_started_at,
  r.data ->> 'dayName'                                       as day_name,
  log.ord                                                    as exercise_order,
  log.value ->> 'exerciseId'                                 as exercise_id,
  log.value ->> 'name'                                       as exercise_name,
  log.value ->> 'category'                                   as category,
  s.ord                                                      as set_number,
  nullif(s.value ->> 'weight', '')::numeric                  as weight,
  nullif(s.value ->> 'reps', '')::numeric                    as reps,
  nullif(s.value ->> 'timeSec', '')::numeric                 as time_sec,
  nullif(s.value ->> 'distance', '')::numeric                as distance,
  (s.value ->> 'done')::boolean                              as done,
  to_timestamp(nullif(s.value ->> 'doneAt', '')::bigint / 1000.0) as done_at
from public.records r
cross join lateral jsonb_array_elements(coalesce(r.data -> 'logs', '[]'::jsonb)) with ordinality as log(value, ord)
cross join lateral jsonb_array_elements(coalesce(log.value -> 'sets', '[]'::jsonb)) with ordinality as s(value, ord)
where r.kind = 'session' and not r.deleted;
