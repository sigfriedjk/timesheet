begin;

-- POP definitions are saved per account. An explicit empty list stays empty.
create or replace function public.timesheet_periods_valid(p_periods jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; ids text[] := '{}'; start_date date; end_date date;
begin
  if jsonb_typeof(p_periods) is distinct from 'array' then return false; end if;
  for item in select value from jsonb_array_elements(p_periods) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item -> 'id') is distinct from 'string'
      or jsonb_typeof(item -> 'name') is distinct from 'string'
      or btrim(item ->> 'id') = '' or btrim(item ->> 'name') = ''
      or (item ->> 'id') = any(ids)
      or jsonb_typeof(item -> 'startDate') is distinct from 'string'
      or jsonb_typeof(item -> 'endDate') is distinct from 'string'
      or (item ->> 'startDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or (item ->> 'endDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(item -> 'targetHours') is distinct from 'number'
      or (item ->> 'targetHours')::numeric < 0 then return false; end if;
    start_date := (item ->> 'startDate')::date;
    end_date := (item ->> 'endDate')::date;
    if start_date > end_date then return false; end if;
    ids := array_append(ids, item ->> 'id');
  end loop;
  return true;
exception when others then return false;
end;
$$;

create table if not exists public.timesheet_pop_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  periods jsonb not null check (public.timesheet_periods_valid(periods)),
  updated_at timestamptz not null default now()
);
alter table public.timesheet_pop_settings enable row level security;
revoke all on public.timesheet_pop_settings from anon, authenticated;
grant select, insert, update, delete on public.timesheet_pop_settings to authenticated;
drop policy if exists timesheet_pop_settings_owner on public.timesheet_pop_settings;
create policy timesheet_pop_settings_owner on public.timesheet_pop_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop trigger if exists timesheet_pop_settings_updated_at on public.timesheet_pop_settings;
create trigger timesheet_pop_settings_updated_at before update on public.timesheet_pop_settings
  for each row execute function public.timesheet_set_updated_at();

-- Replaces all saved inputs for auth.uid() in one transaction. Any error rolls
-- back deletes and inserts together. Calculated monthly balances are not stored.
create or replace function public.replace_timesheet_workspace(p_logs jsonb, p_report jsonb, p_periods jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare restored integer;
begin
  if auth.uid() is null then raise exception 'Sign in before replacing your timesheet'; end if;
  if jsonb_typeof(p_logs) is distinct from 'array' then raise exception 'Logs must be an array'; end if;
  if p_report is null then raise exception 'Leave settings are required'; end if;
  if not public.timesheet_periods_valid(p_periods) then raise exception 'Invalid POP definitions'; end if;

  delete from public.timesheet_logs where user_id = auth.uid();
  delete from public.timesheet_reports where user_id = auth.uid();
  delete from public.timesheet_pop_settings where user_id = auth.uid();

  insert into public.timesheet_logs (user_id, date, total_hours, notes)
    select auth.uid(), (item ->> 'date')::date, (item ->> 'total_hours')::numeric, item ->> 'notes'
    from jsonb_array_elements(p_logs) as item;
  get diagnostics restored = row_count;
  insert into public.timesheet_reports (user_id, state) values (auth.uid(), p_report);
  insert into public.timesheet_pop_settings (user_id, periods) values (auth.uid(), p_periods);
  return restored;
end;
$$;
revoke all on function public.replace_timesheet_workspace(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_timesheet_workspace(jsonb, jsonb, jsonb) to authenticated;

commit;
