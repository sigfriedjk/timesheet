import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyReportState, PeriodOfPerformance, TimeLog } from '../types';
import { roundToTenth } from '../utils/calculations';
import { requirePtoAccrualRate } from '../utils/ptoAccrualRate';
import { normalizeMonthlyReport } from './monthlyReport';

interface LogRow {
  id: string;
  date: string;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
const mapLog = (row: LogRow): TimeLog => ({
  id: row.id,
  date: row.date,
  totalHours: Number(row.total_hours),
  notes: row.notes ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/** Every request is scoped to the signed-in user; database RLS enforces the same rule. */
export function createSupabaseRepository(client: SupabaseClient, userId: string) {
  return {
    async load() {
      // Supabase caps individual responses, so years of history must be paged.
      const logs: TimeLog[] = [];
      const pageSize = 500;
      for (let start = 0; ; start += pageSize) {
        const { data, error } = await client
          .from('timesheet_logs')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .range(start, start + pageSize - 1);
        check(error);
        if (!data) throw new Error('Supabase returned no log data. Please reload.');
        logs.push(...(data as LogRow[]).map(mapLog));
        if (data.length < pageSize) break;
      }
      const { data, error } = await client
        .from('timesheet_reports')
        .select('state')
        .eq('user_id', userId)
        .maybeSingle();
      check(error);
      const { data: popData, error: popError } = await client
        .from('timesheet_pop_settings')
        .select('periods')
        .eq('user_id', userId)
        .maybeSingle();
      check(popError);
      return {
        logs,
        report: normalizeMonthlyReport(data?.state ?? null),
        periods: (popData?.periods ?? []) as PeriodOfPerformance[],
      };
    },
    async saveLog(date: string, hours: number, notes?: string) {
      const { data, error } = await client
        .from('timesheet_logs')
        .upsert(
          { user_id: userId, date, total_hours: roundToTenth(hours), notes: notes ?? null },
          { onConflict: 'user_id,date' },
        )
        .select()
        .single();
      check(error);
      if (!data) throw new Error('The entry was not saved. Please retry.');
      return mapLog(data as LogRow);
    },
    async fillWeekdays(dates: string[]) {
      if (!dates.length) return [];
      // One statement, with conflict protection for dates saved by another tab/device.
      const { data, error } = await client
        .from('timesheet_logs')
        .upsert(
          dates.map((date) => ({ user_id: userId, date, total_hours: 8, notes: null })),
          { onConflict: 'user_id,date', ignoreDuplicates: true },
        )
        .select();
      check(error);
      if (!data)
        throw new Error('Autofill was not acknowledged. Reload your timesheet before retrying.');
      return (data as LogRow[]).map(mapLog);
    },
    async deleteLog(date: string) {
      const { data, error } = await client
        .from('timesheet_logs')
        .delete()
        .eq('user_id', userId)
        .eq('date', date)
        .select('date');
      check(error);
      if (!data?.length)
        throw new Error('The entry could not be deleted. Reload your timesheet and try again.');
    },
    async saveReport(state: MonthlyReportState) {
      if (state.settings.ptoAccrualRate != null)
        requirePtoAccrualRate(state.settings.ptoAccrualRate);
      const report = normalizeMonthlyReport({ ...state, ptoPolicyVersion: 1 });
      const { data, error } = await client
        .from('timesheet_reports')
        .upsert({ user_id: userId, state: report }, { onConflict: 'user_id' })
        .select('state')
        .single();
      check(error);
      if (!data) throw new Error('Leave settings were not saved. Please retry.');
      return report;
    },
    async savePeriods(periods: PeriodOfPerformance[]) {
      const { data, error } = await client
        .from('timesheet_pop_settings')
        .upsert({ user_id: userId, periods }, { onConflict: 'user_id' })
        .select('periods')
        .single();
      check(error);
      if (!data) throw new Error('POP changes were not saved. Please retry.');
      return data.periods as PeriodOfPerformance[];
    },
    async replaceWorkspace(
      logs: TimeLog[],
      report: MonthlyReportState,
      periods: PeriodOfPerformance[] | undefined,
    ) {
      const { data, error } = await client.rpc('replace_timesheet_workspace', {
        p_logs: logs.map((log) => ({
          date: log.date,
          total_hours: roundToTenth(log.totalHours),
          notes: log.notes ?? null,
        })),
        p_report: report,
        p_periods: periods ?? null,
      });
      check(error);
      if (typeof data !== 'number')
        throw new Error('The replacement was not acknowledged. Please reload your data.');
      return data;
    },
  };
}
