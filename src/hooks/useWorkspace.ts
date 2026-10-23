import { useEffect, useMemo, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyReportState, PeriodOfPerformance, WorkspaceData } from '../types';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';
import { createSupabaseRepository } from '../services/supabaseRepository';
import { defaultPeriods, deleteTimeLog, getMonthlyReportState, getSamplePeriods, initializeSampleLogs, LogDataset, replaceSampleWorkspace, saveMonthlyReportState, saveSamplePeriods, saveTimeLog } from '../services/storage';
import { parseTimesheetJson, validatePeriods } from '../services/jsonBackup';

type Data = WorkspaceData;
const empty = (): Data => ({ logs: [], report: createDefaultMonthlyReport(), periods: defaultPeriods() });
const loadSample = (): Data => ({ logs: initializeSampleLogs(), report: getMonthlyReportState('sample2026'), periods: getSamplePeriods() });

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
        const data = repository ? await repository.load() : loadSample();
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
    logs: current ? snapshot.logs : [], report: current ? snapshot.report : createDefaultMonthlyReport(), periods: current ? snapshot.periods : defaultPeriods(), ready,
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
    savePeriods: (periods: PeriodOfPerformance[]) => operation(async () => {
      const valid = validatePeriods(periods);
      const saved = repository ? await repository.savePeriods(valid) : (saveSamplePeriods(valid), valid);
      apply({ periods: saved });
    }),
    importJson: (contents: string) => operation(async () => {
      const backup = parseTimesheetJson(contents);
      if (backup.dataset && backup.dataset !== dataset) throw new Error(`This backup belongs to ${backup.dataset === 'sample2026' ? '2026 sample data' : 'My data'}. Switch data source before importing it.`);
      const report = backup.report ?? createDefaultMonthlyReport(dataset === 'sample2026' ? 2026 : undefined);
      const periods = backup.periods ?? defaultPeriods();
      const count = repository ? await repository.replaceWorkspace(backup.logs, report, periods)
        : (replaceSampleWorkspace({ logs: backup.logs, report, periods }), backup.logs.length);
      assertCurrent();
      const data = repository ? await repository.load() : loadSample();
      apply(data);
      return count;
    }),
    resetSample: () => {
      if (dataset !== 'sample2026' || pending.current) return 0;
      assertCurrent();
      const logs = initializeSampleLogs(true);
      apply({ logs, report: getMonthlyReportState('sample2026'), periods: getSamplePeriods() });
      return logs.length;
    },
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
