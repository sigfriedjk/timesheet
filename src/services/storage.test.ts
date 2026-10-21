import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllTimeLogs,
  getTimeLogByDate,
  saveTimeLog,
  deleteTimeLog,
  clearStorageForTesting,
  initializeSampleLogs,
  getActiveLogDataset,
  setActiveLogDataset,
  getMonthlyReportState,
  saveMonthlyReportState,
} from './storage';

describe('Storage Service (Local-First Persistence & Overwrite Logic)', () => {
  beforeEach(() => {
    clearStorageForTesting();
  });

  it('saves a new time log with rounded hours to 0.1', () => {
    const result = saveTimeLog('2026-10-16', 8.04, 'Normal shift');
    expect(result.isOverwrite).toBe(false);
    expect(result.log.totalHours).toBe(8.0);
    expect(result.log.date).toBe('2026-10-16');
    expect(result.log.notes).toBe('Normal shift');

    const retrieved = getTimeLogByDate('2026-10-16');
    expect(retrieved).toBeDefined();
    expect(retrieved?.totalHours).toBe(8.0);
  });

  it('overwrites previous time log on the same date with updated hours', () => {
    // Initial save (e.g., midday check-in: 4.2 hours)
    const initial = saveTimeLog('2026-10-16', 4.2, 'Midday sync');
    expect(initial.isOverwrite).toBe(false);
    expect(initial.log.totalHours).toBe(4.2);

    // Later in the day: user works more hours (9.6 hours)
    const updated = saveTimeLog('2026-10-16', 9.58, 'Full shift complete');
    expect(updated.isOverwrite).toBe(true);
    expect(updated.log.totalHours).toBe(9.6);
    expect(updated.log.notes).toBe('Full shift complete');

    // Only one entry should exist for this date
    const all = getAllTimeLogs();
    const matching = all.filter((l) => l.date === '2026-10-16');
    expect(matching.length).toBe(1);
    expect(matching[0].totalHours).toBe(9.6);
  });

  it('deletes a log entry by date', () => {
    saveTimeLog('2026-10-15', 8.0);
    expect(getTimeLogByDate('2026-10-15')).toBeDefined();

    const deleted = deleteTimeLog('2026-10-15');
    expect(deleted).toBe(true);
    expect(getTimeLogByDate('2026-10-15')).toBeUndefined();
  });
});

describe('Isolated sample workspace', () => {
  beforeEach(clearStorageForTesting);

  it('loads sample entries without replacing personal entries on overlapping dates', () => {
    saveTimeLog('2026-01-02', 7.5, 'My real entry');
    expect(initializeSampleLogs()).toHaveLength(149);
    expect(getTimeLogByDate('2026-01-02')?.totalHours).toBe(7.5);
    expect(getTimeLogByDate('2026-01-02', 'sample2026')?.totalHours).toBe(6);
    expect(getAllTimeLogs()).toHaveLength(1);
  });

  it('keeps sample edits and deletions isolated and restores only the sample when reset', () => {
    const personal = saveTimeLog('2026-01-02', 7.5, 'Personal').log;
    initializeSampleLogs();
    saveTimeLog('2026-01-02', 9.3, 'Test edit', 'sample2026');
    deleteTimeLog('2026-01-05', 'sample2026');
    expect(initializeSampleLogs()).toHaveLength(148);
    expect(getTimeLogByDate('2026-01-02', 'sample2026')?.totalHours).toBe(9.3);
    expect(initializeSampleLogs(true)).toHaveLength(149);
    expect(getTimeLogByDate('2026-01-02', 'sample2026')?.totalHours).toBe(6);
    expect(getAllTimeLogs()).toEqual([personal]);
  });

  it('does not recreate deleted sample records without an explicit reset', () => {
    for (const log of initializeSampleLogs()) deleteTimeLog(log.date, 'sample2026');
    expect(initializeSampleLogs()).toEqual([]);
    expect(getAllTimeLogs()).toEqual([]);
  });

  it('remembers the selected workspace without mixing the stored records', () => {
    expect(getActiveLogDataset()).toBe('personal');
    setActiveLogDataset('sample2026');
    expect(getActiveLogDataset()).toBe('sample2026');
    setActiveLogDataset('personal');
    expect(getActiveLogDataset()).toBe('personal');
  });
});

describe('Monthly report persistence', () => {
  beforeEach(clearStorageForTesting);
  it.each(['personal', 'sample2026'] as const)('migrates legacy %s PTO policy once without losing report data or later opt-outs', (dataset) => {
    const key = `work_hours_tracker_${dataset}_monthly_report`;
    const legacy = getMonthlyReportState(dataset);
    delete legacy.ptoPolicyVersion;
    legacy.settings.autoPto = false;
    legacy.settings.openingPto = 91.23;
    legacy.entries = [{ id: 'override', date: '2026-03-31', category: 'pto', hours: 0 }];
    legacy.projectedWork = { '2026-11': 144 };
    const store = new Map([[key, JSON.stringify(legacy)]]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (name: string) => store.get(name) ?? null,
      setItem: (name: string, value: string) => store.set(name, value),
    } });
    try {
      const migrated = getMonthlyReportState(dataset);
      expect(migrated).toEqual({ ...legacy, ptoPolicyVersion: 1, settings: { ...legacy.settings, autoPto: true } });
      expect(JSON.parse(store.get(key)!)).toEqual(migrated);
      migrated.settings.autoPto = false;
      saveMonthlyReportState(migrated, dataset);
      expect(getMonthlyReportState(dataset)).toEqual(migrated);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('persists opening balances, leave entries, and monthly forecasts separately for personal and sample workspaces', () => {
    const personal = getMonthlyReportState();
    personal.settings.openingPto = 91.23;
    personal.entries.push({ id: 'personal-leave', date: '2026-03-03', category: 'pto', hours: 8 });
    personal.projectedWork['2026-11'] = 144;
    saveMonthlyReportState(personal);
    const sampleState = getMonthlyReportState('sample2026');
    sampleState.settings.openingPto = 20;
    saveMonthlyReportState(sampleState, 'sample2026');
    expect(getMonthlyReportState()).toEqual(personal);
    expect(getMonthlyReportState('sample2026').settings.openingPto).toBe(20);
    initializeSampleLogs(true);
    expect(getMonthlyReportState('sample2026').settings.openingPto).toBe(0);
    expect(getMonthlyReportState()).toEqual(personal);
  });
});
