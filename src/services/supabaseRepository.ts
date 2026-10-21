import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyReportState, TimeLog } from '../types';
import { roundToTenth } from '../utils/calculations';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';

interface LogRow { id: string; date: string; total_hours: number; notes: string | null; created_at: string; updated_at: string }
const mapLog = (row: LogRow): TimeLog => ({ id: row.id, date: row.date, totalHours: Number(row.total_hours), notes: row.notes ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at });
const check = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export function normalizeMonthlyReport(parsed: Partial<MonthlyReportState> | null): MonthlyReportState {
  const fallback = createDefaultMonthlyReport();
  if (!parsed || !Array.isArray(parsed.entries)) return fallback;
  const state = { ...fallback, ...parsed, settings: { ...fallback.settings, ...parsed.settings }, entries: parsed.entries, projectedWork: parsed.projectedWork ?? {} };
  if ((parsed.ptoPolicyVersion ?? 0) < 1) { state.ptoPolicyVersion = 1; state.settings.autoPto = true; }
  return state;
}

/** Every request is scoped to the signed-in user; database RLS enforces the same rule. */
export function createSupabaseRepository(client: SupabaseClient, userId: string) {
  return {
    async load() {
      // Supabase caps individual responses, so years of history must be paged.
      const logs: TimeLog[] = [];
      const pageSize = 500;
      for (let start = 0; ; start += pageSize) {
        const { data, error } = await client.from('timesheet_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).range(start, start + pageSize - 1);
        check(error);
        logs.push(...(data as LogRow[]).map(mapLog));
        if (data.length < pageSize) break;
      }
      const { data, error } = await client.from('timesheet_reports').select('state').eq('user_id', userId).maybeSingle();
      check(error);
      return { logs, report: normalizeMonthlyReport(data?.state ?? null) };
    },
    async saveLog(date: string, hours: number, notes?: string) {
      const { data, error } = await client.from('timesheet_logs').upsert({ user_id: userId, date, total_hours: roundToTenth(hours), notes: notes ?? null }, { onConflict: 'user_id,date' }).select().single();
      check(error);
      return mapLog(data as LogRow);
    },
    async deleteLog(date: string) {
      const { data, error } = await client.from('timesheet_logs').delete().eq('user_id', userId).eq('date', date).select('date');
      check(error);
      if (!data.length) throw new Error('The entry could not be deleted. Reload your timesheet and try again.');
    },
    async saveReport(state: MonthlyReportState) {
      const report = { ...state, ptoPolicyVersion: 1 };
      const { error } = await client.from('timesheet_reports').upsert({ user_id: userId, state: report }, { onConflict: 'user_id' });
      check(error);
      return report;
    },
    async importBrowserData(logs: TimeLog[], report: MonthlyReportState | null) {
      const { data, error } = await client.rpc('import_browser_timesheet', {
        p_logs: logs.map(log => ({ date: log.date, total_hours: roundToTenth(log.totalHours), notes: log.notes ?? null })),
        p_report: report,
      });
      check(error);
      return Number(data);
    },
  };
}
