import { describe, it, expect, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseRepository, normalizeMonthlyReport } from './supabaseRepository';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';

const row = (date: string) => ({ id: date, date, total_hours: '8.5', notes: null, created_at: 'created', updated_at: 'updated' });
function setup(handler: (url: URL, init: RequestInit) => Response) {
  const requests: { url: URL; init: RequestInit }[] = [];
  const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, init: init! });
    return handler(url, init!);
  });
  const client = createClient('https://test.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: request },
  });
  return { repository: createSupabaseRepository(client, 'user-a'), requests };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('Supabase repository through the real SDK', () => {
  it('pages long histories and scopes every read to the current user', async () => {
    const report = createDefaultMonthlyReport(); report.settings.autoPto = false;
    const { repository, requests } = setup(url => url.pathname.endsWith('timesheet_pop_settings') ? json(null) : url.pathname.endsWith('timesheet_reports') ? json({ state: report }) : json(Array.from({ length: url.searchParams.get('offset') === '0' ? 500 : 2 }, () => row('2026-10-21'))));
    const result = await repository.load();
    expect(result.logs).toHaveLength(502);
    expect(result.logs[0]).toMatchObject({ totalHours: 8.5, notes: undefined });
    expect(result.report.settings.autoPto).toBe(false);
    expect(requests).toHaveLength(4);
    expect(result.periods).toHaveLength(24);
    expect(requests.every(({ url }) => url.searchParams.get('user_id') === 'eq.user-a')).toBe(true);
    expect(requests[1].url.searchParams.get('offset')).toBe('500');
    expect(requests[0].url.searchParams.get('order')).toBe('date.desc');
  });
  it('surfaces load and write errors without falling back to local storage', async () => {
    const { repository } = setup(() => json({ message: 'Permission denied', code: '42501' }, 403));
    await expect(repository.load()).rejects.toThrow('Permission denied');
    await expect(repository.saveLog('2026-10-21', 8)).rejects.toThrow('Permission denied');
    await expect(repository.saveReport(createDefaultMonthlyReport())).rejects.toThrow('Permission denied');
    await expect(repository.deleteLog('2026-10-21')).rejects.toThrow('Permission denied');
    await expect(repository.importBrowserData([], null)).rejects.toThrow('Permission denied');
  });
  it('requires deletion acknowledgement and scopes the date and user', async () => {
    const { repository, requests } = setup(() => json([]));
    await expect(repository.deleteLog('2026-10-21')).rejects.toThrow('could not be deleted');
    expect(requests[0].init.method).toBe('DELETE');
    expect(requests[0].url.searchParams.get('user_id')).toBe('eq.user-a');
    expect(requests[0].url.searchParams.get('date')).toBe('eq.2026-10-21');
  });
  it('rounds log writes, clears notes, and verifies the returned row', async () => {
    const { repository, requests } = setup(() => json(row('2026-10-21')));
    await repository.saveLog('2026-10-21', 8.56);
    expect(JSON.parse(requests[0].init.body as string)).toEqual({ user_id: 'user-a', date: '2026-10-21', total_hours: 8.6, notes: null });
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('user_id,date');
  });
  it('persists report state and imports logs and report in one RPC', async () => {
    const report = createDefaultMonthlyReport();
    const { repository, requests } = setup(url => url.pathname.includes('/rpc/') ? json(2) : json({ state: report }));
    await repository.saveReport(report);
    const count = await repository.importBrowserData([{ id: 'a', date: '2026-10-21', totalHours: 8.56, notes: 'old', createdAt: '', updatedAt: '' }], report);
    expect(count).toBe(2);
    expect(JSON.parse(requests[0].init.body as string)).toEqual({ user_id: 'user-a', state: report });
    expect(requests[1].url.pathname).toBe('/rest/v1/rpc/import_browser_timesheet');
    expect(JSON.parse(requests[1].init.body as string)).toEqual({ p_logs: [{ date: '2026-10-21', total_hours: 8.6, notes: 'old' }], p_report: report });
  });
  it('normalizes older reports once and preserves later PTO opt-outs', () => {
    const old = { ...createDefaultMonthlyReport(), ptoPolicyVersion: 0 };
    old.settings.autoPto = false;
    expect(normalizeMonthlyReport(old).settings.autoPto).toBe(true);
    expect(normalizeMonthlyReport({ ...old, ptoPolicyVersion: 1 }).settings.autoPto).toBe(false);
    expect(normalizeMonthlyReport(null).entries).toEqual([]);
    const withCalculatedData = { ...old, monthlyBalances: { pto: 123 }, settings: { ...old.settings, birthdayMonth: 5 } };
    expect(normalizeMonthlyReport(withCalculatedData)).not.toHaveProperty('monthlyBalances');
    expect(normalizeMonthlyReport(withCalculatedData).settings).not.toHaveProperty('birthdayMonth');
  });
  it('restores all saved inputs in one RPC and preserves an explicitly empty POP list on load', async () => {
    const report = createDefaultMonthlyReport();
    const { repository, requests } = setup(url => url.pathname.includes('/rpc/') ? json(0) : url.pathname.endsWith('timesheet_reports') ? json({ state: report }) : url.pathname.endsWith('timesheet_pop_settings') ? json({ periods: [] }) : json([]));
    expect(await repository.replaceWorkspace([], report, [])).toBe(0);
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/replace_timesheet_workspace');
    expect(JSON.parse(requests[0].init.body as string)).toEqual({ p_logs: [], p_report: report, p_periods: [] });
    expect((await repository.load()).periods).toEqual([]);
  });
});
