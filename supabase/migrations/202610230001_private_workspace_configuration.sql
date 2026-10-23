begin;

-- Hours of PTO earned per hour worked, from 0 through 1 inclusive, with
-- at most eight decimal places. Null/missing means not configured, not zero.
create or replace function public.timesheet_pto_rate_valid(p_rate jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare rate numeric;
begin
  if jsonb_typeof(p_rate) is distinct from 'number' then return false; end if;
  rate := (p_rate #>> '{}')::numeric;
  return rate >= 0 and rate <= 1 and rate = round(rate, 8);
exception when others then return false;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'timesheet_reports_pto_rate'
    and conrelid = 'public.timesheet_reports'::regclass) then
    alter table public.timesheet_reports add constraint timesheet_reports_pto_rate check (
      not ((state -> 'settings') ? 'ptoAccrualRate')
      or state -> 'settings' -> 'ptoAccrualRate' = 'null'::jsonb
      or public.timesheet_pto_rate_valid(state -> 'settings' -> 'ptoAccrualRate')
    );
  end if;
end $$;

-- The currently deployed client does not know this setting yet. Its saves
-- must not erase a migrated rate while the new application awaits deployment.
create or replace function public.timesheet_preserve_omitted_pto_rate()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not ((new.state -> 'settings') ? 'ptoAccrualRate')
    and (old.state -> 'settings') ? 'ptoAccrualRate' then
    new.state := jsonb_set(new.state, '{settings,ptoAccrualRate}',
      old.state -> 'settings' -> 'ptoAccrualRate');
  end if;
  return new;
end;
$$;
drop trigger if exists timesheet_reports_preserve_rate on public.timesheet_reports;
create trigger timesheet_reports_preserve_rate before update on public.timesheet_reports
  for each row execute function public.timesheet_preserve_omitted_pto_rate();

-- Server-only, explicit-account backfill. There are no embedded owner values.
-- A saved POP row (even []) and any configured rate always take precedence.
create or replace function public.timesheet_seed_workspace_configuration(
  p_owner uuid, p_periods jsonb, p_report jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare pop_count integer; report_count integer;
begin
  if not public.timesheet_periods_valid(p_periods)
    or not public.timesheet_pto_rate_valid(p_report -> 'settings' -> 'ptoAccrualRate') then
    raise exception 'Invalid migration configuration';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));
  insert into public.timesheet_pop_settings(user_id, periods) values (p_owner, p_periods)
    on conflict (user_id) do nothing;
  get diagnostics pop_count = row_count;
  insert into public.timesheet_reports(user_id, state) values (p_owner, p_report)
    on conflict (user_id) do update set state = jsonb_set(
      timesheet_reports.state, '{settings,ptoAccrualRate}',
      excluded.state -> 'settings' -> 'ptoAccrualRate')
    where timesheet_reports.state -> 'settings' -> 'ptoAccrualRate' is null
      or timesheet_reports.state -> 'settings' -> 'ptoAccrualRate' = 'null'::jsonb;
  get diagnostics report_count = row_count;
  return jsonb_build_object('popInserted', pop_count = 1, 'rateInserted', report_count = 1);
end;
$$;
revoke all on function public.timesheet_seed_workspace_configuration(uuid, jsonb, jsonb)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.timesheet_seed_workspace_configuration(uuid, jsonb, jsonb)
      to service_role;
  end if;
end $$;

-- Keep the existing RPC signature so older clients remain compatible. Resolve
-- omitted legacy configuration under the same transaction as the replacement.
create or replace function public.replace_timesheet_workspace(p_logs jsonb, p_report jsonb, p_periods jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare restored integer; previous_state jsonb; rate jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in before replacing your timesheet'; end if;
  if jsonb_typeof(p_logs) is distinct from 'array' then raise exception 'Logs must be an array'; end if;
  if p_report is null then raise exception 'Leave settings are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select state into previous_state from public.timesheet_reports
    where user_id = auth.uid() for update;
  rate := p_report -> 'settings' -> 'ptoAccrualRate';
  if rate is null or rate = 'null'::jsonb then
    rate := previous_state -> 'settings' -> 'ptoAccrualRate';
  end if;
  if not public.timesheet_pto_rate_valid(rate) then
    raise exception 'Set a valid PTO accrual rate before restoring a backup without one';
  end if;
  p_report := jsonb_set(p_report, '{settings,ptoAccrualRate}', rate);
  if p_periods is null then
    select periods into p_periods from public.timesheet_pop_settings where user_id = auth.uid() for update;
    p_periods := coalesce(p_periods, '[]'::jsonb);
  end if;
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
