import { useEffect, useMemo, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyReportState, TimeLog } from '../types';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';
import { createSupabaseRepository } from '../services/supabaseRepository';
import { deleteTimeLog, getAllTimeLogs, getMonthlyReportState, initializeSampleLogs, LogDataset, saveMonthlyReportState, saveTimeLog } from '../services/storage';

export function useWorkspace(dataset: LogDataset, client: SupabaseClient | null, userId?: string) {
  const repository = useMemo(() => dataset === 'personal' && client && userId ? createSupabaseRepository(client, userId) : null, [dataset, client, userId]);
  const identity = repository ?? dataset;
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ identity: typeof identity | null; logs: TimeLog[]; report: MonthlyReportState; ready: boolean; error: string }>({ identity: null, logs: [], report: createDefaultMonthlyReport(), ready: false, error: '' });
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setSnapshot({ identity, logs: [], report: createDefaultMonthlyReport(), ready: false, error: '' });
    const load = async () => {
      try {
        if (dataset === 'personal' && !repository) return;
        const data = repository ? await repository.load() : { logs: initializeSampleLogs(), report: getMonthlyReportState('sample2026') };
        if (active) setSnapshot({ identity, ...data, ready: true, error: '' });
      } catch (error) { if (active) setSnapshot(previous => ({ ...previous, ready: false, error: error instanceof Error ? error.message : 'Could not load Supabase data.' })); }
    };
    void load();
    return () => { active = false; };
  }, [identity, dataset, repository, revision]);
  const current = snapshot.identity === identity;
  const ready = current && snapshot.ready;
  const apply = (change: Partial<typeof snapshot>) => { if (mounted.current && activeIdentity.current === identity) setSnapshot(previous => ({ ...previous, ...change })); };
  const operation = async <T,>(action: () => Promise<T>) => {
    if (!ready) throw new Error('Your timesheet is not ready. Sign in and reload your data.');
    if (pending.current) throw new Error('Wait for the current save to finish, then try again.');
    pending.current = true;
    setBusy(true);
    try { return await action(); } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return {
    logs: current ? snapshot.logs : [], report: current ? snapshot.report : createDefaultMonthlyReport(), ready,
    error: current ? snapshot.error : '', busy,
    reload: () => setRevision(value => value + 1),
    saveLog: (date: string, hours: number, notes?: string) => operation(async () => {
      const log = repository ? await repository.saveLog(date, hours, notes) : saveTimeLog(date, hours, notes, 'sample2026').log;
      apply({ logs: [log, ...snapshot.logs.filter(item => item.date !== date)].sort((a, b) => b.date.localeCompare(a.date)) });
      return log;
    }),
    deleteLog: (date: string) => operation(async () => {
      if (repository) await repository.deleteLog(date); else deleteTimeLog(date, 'sample2026');
      apply({ logs: snapshot.logs.filter(item => item.date !== date) });
    }),
    saveReport: (report: MonthlyReportState) => operation(async () => {
      if (repository) await repository.saveReport(report); else saveMonthlyReportState(report, 'sample2026');
      apply({ report });
    }),
    importBrowser: () => operation(async () => {
      if (!repository) throw new Error('Sign in to Supabase before importing personal browser data.');
      const count = await repository.importBrowserData(getAllTimeLogs(), getLegacyReport());
      const data = await repository.load();
      apply(data);
      return count;
    }),
    resetSample: () => {
      if (dataset !== 'sample2026') return 0;
      const logs = initializeSampleLogs(true);
      apply({ logs, report: getMonthlyReportState('sample2026') });
      return logs.length;
    },
  };
}

export function getLegacyReport(): MonthlyReportState | null {
  try { return window.localStorage.getItem('work_hours_tracker_personal_monthly_report') ? getMonthlyReportState() : null; } catch { return null; }
}
export type Workspace = ReturnType<typeof useWorkspace>;
