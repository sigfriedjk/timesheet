-- Run once in the Supabase SQL Editor. Safe to run again for this schema.
-- Uses Supabase Auth; the public browser key never grants access to another user.
begin;

create table if not exists public.timesheet_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  id text not null default gen_random_uuid()::text,
  total_hours numeric(4,1) not null check (total_hours >= 0 and total_hours <= 24),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.timesheet_reports (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null check (
    jsonb_typeof(state) = 'object'
    and jsonb_typeof(state -> 'settings') = 'object'
    and jsonb_typeof(state -> 'entries') = 'array'
    and jsonb_typeof(state -> 'projectedWork') = 'object'
    and state ?& array['settings', 'entries', 'projectedWork']
  ),
  updated_at timestamptz not null default now()
);

alter table public.timesheet_logs enable row level security;
alter table public.timesheet_reports enable row level security;
-- Supabase projects may grant ALL by default, including TRUNCATE (which bypasses RLS).
-- Reset browser-role privileges before granting only the operations used by the app.
revoke all on public.timesheet_logs, public.timesheet_reports from anon, authenticated;
grant select, insert, update, delete on public.timesheet_logs, public.timesheet_reports to authenticated;

drop policy if exists timesheet_logs_owner on public.timesheet_logs;
create policy timesheet_logs_owner on public.timesheet_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists timesheet_reports_owner on public.timesheet_reports;
create policy timesheet_reports_owner on public.timesheet_reports for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.timesheet_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists timesheet_logs_updated_at on public.timesheet_logs;
create trigger timesheet_logs_updated_at before update on public.timesheet_logs
  for each row execute function public.timesheet_set_updated_at();
drop trigger if exists timesheet_reports_updated_at on public.timesheet_reports;
create trigger timesheet_reports_updated_at before update on public.timesheet_reports
  for each row execute function public.timesheet_set_updated_at();

-- Atomic import: keeps existing cloud dates/settings and leaves browser originals intact.
create or replace function public.import_browser_timesheet(p_logs jsonb, p_report jsonb default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare imported integer;
begin
  if auth.uid() is null then raise exception 'Sign in before importing browser data'; end if;
  if jsonb_typeof(p_logs) is distinct from 'array' then raise exception 'Logs must be an array'; end if;
  insert into public.timesheet_logs (user_id, date, total_hours, notes)
    select auth.uid(), (item ->> 'date')::date, (item ->> 'total_hours')::numeric, item ->> 'notes'
    from jsonb_array_elements(p_logs) as item
    on conflict (user_id, date) do nothing;
  get diagnostics imported = row_count;
  if p_report is not null then
    insert into public.timesheet_reports (user_id, state) values (auth.uid(), p_report)
      on conflict (user_id) do nothing;
  end if;
  return imported;
end;
$$;
revoke all on function public.import_browser_timesheet(jsonb, jsonb) from public, anon;
grant execute on function public.import_browser_timesheet(jsonb, jsonb) to authenticated;

commit;
