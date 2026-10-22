import { useEffect, useMemo, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyReportState, TimeLog } from '../types';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';
import { createSupabaseRepository, normalizeMonthlyReport } from '../services/supabaseRepository';
import { deleteTimeLog, getAllTimeLogs, getMonthlyReportState, initializeSampleLogs, LogDataset, saveMonthlyReportState, saveTimeLog } from '../services/storage';

type Data = { logs: TimeLog[]; report: MonthlyReportState };
const empty = (): Data => ({ logs: [], report: createDefaultMonthlyReport() });

export function useWorkspace(dataset: LogDataset, client: SupabaseClient | null, userId?: string) {
  const repository = useMemo(() => dataset === 'personal' && client && userId ? createSupabaseRepository(client, userId) : null, [dataset, client, userId]);
  // An object identifies each visit, including sample -> personal -> sample transitions.
  const identity = useMemo(() => ({}), [dataset, repository]);
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Data & { identity: object | null; ready: boolean; error: string }>({ ...empty(), identity: null, ready: false, error: '' });
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const [savingIdentity, setSavingIdentity] = useState<object | null>(null);
  const pending = useRef<object | null>(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setSnapshot({ ...empty(), identity, ready: false, error: '' });
    const load = async () => {
      try {
        if (dataset === 'personal' && !repository) return;
        const data = repository ? await repository.load() : { logs: initializeSampleLogs(), report: getMonthlyReportState('sample2026') };
        if (active) setSnapshot({ identity, ...data, ready: true, error: '' });
      } catch (error) {
        if (active) setSnapshot({ ...empty(), identity, ready: false, error: error instanceof Error ? error.message : 'Could not load Supabase data.' });
      }
    };
    void load();
    return () => { active = false; };
  }, [identity, dataset, repository, revision]);
  const current = snapshot.identity === identity;
  const ready = current && snapshot.ready;
  const assertCurrent = () => {
    if (!mounted.current || activeIdentity.current !== identity) throw new Error('Your account or data source changed. Reopen the editor and try again.');
  };
  const apply = (change: Partial<Data>) => {
    assertCurrent();
    setSnapshot(previous => previous.identity === identity ? { ...previous, ...change } : previous);
  };
  const operation = async <T,>(action: (data: Data) => Promise<T>) => {
    assertCurrent();
    if (!ready || latest.current.identity !== identity || !latest.current.ready) throw new Error('Your timesheet is not ready. Sign in and reload your data.');
    if (pending.current) throw new Error('Wait for the current save to finish, then try again.');
    const token = {};
    pending.current = token;
    setSavingIdentity(identity);
    try {
      const result = await action(latest.current);
      assertCurrent();
      return result;
    } finally {
      if (pending.current === token) pending.current = null;
      if (mounted.current) setSavingIdentity(null);
    }
  };
  return {
    logs: current ? snapshot.logs : [], report: current ? snapshot.report : createDefaultMonthlyReport(), ready,
    error: current ? snapshot.error : '', busy: savingIdentity === identity,
    reload: () => {
      if (pending.current) return;
      setSnapshot({ ...empty(), identity, ready: false, error: '' });
      setRevision(value => value + 1);
    },
    saveLog: (date: string, hours: number, notes?: string) => operation(async data => {
      const log = repository ? await repository.saveLog(date, hours, notes) : saveTimeLog(date, hours, notes, 'sample2026').log;
      apply({ logs: [log, ...data.logs.filter(item => item.date !== date)].sort((a, b) => b.date.localeCompare(a.date)) });
      return log;
    }),
    deleteLog: (date: string) => operation(async data => {
      if (repository) await repository.deleteLog(date); else deleteTimeLog(date, 'sample2026');
      apply({ logs: data.logs.filter(item => item.date !== date) });
    }),
    saveReport: (report: MonthlyReportState) => operation(async () => {
      const saved = repository ? await repository.saveReport(report) : (saveMonthlyReportState(report, 'sample2026'), report);
      apply({ report: saved });
    }),
    importBrowser: () => operation(async () => {
      if (!repository) throw new Error('Sign in to Supabase before importing personal browser data.');
      const count = await repository.importBrowserData(getAllTimeLogs(), getLegacyReport());
      assertCurrent();
      const data = await repository.load();
      apply(data);
      return count;
    }),
    resetSample: () => {
      if (dataset !== 'sample2026' || pending.current) return 0;
      assertCurrent();
      const logs = initializeSampleLogs(true);
      apply({ logs, report: getMonthlyReportState('sample2026') });
      return logs.length;
    },
  };
}

export function getLegacyReport(): MonthlyReportState | null {
  // Reading a legacy report must not perform the old storage migration or alter originals.
  try {
    const stored = window.localStorage.getItem('work_hours_tracker_personal_monthly_report');
    return stored ? normalizeMonthlyReport(JSON.parse(stored)) : null;
  } catch { return null; }
}
export type Workspace = ReturnType<typeof useWorkspace>;
