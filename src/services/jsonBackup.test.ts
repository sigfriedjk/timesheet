import { describe, expect, it } from 'vitest';
import { exportTimesheetJson, parseTimesheetJson } from './jsonBackup';
import { createDefaultMonthlyReport } from '../services/monthlyReport';
import { samplePeriods } from '../config/sampleWorkspace';

const log = { id: 'a', date: '2026-10-01', totalHours: 8.1, notes: 'Worked', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z' };
const configuredReport = (year?: number) => {
  const state = createDefaultMonthlyReport(year);
  state.settings.ptoAccrualRate = 0.125;
  return state;
};
describe('JSON timesheet backups', () => {
  it('round trips entries, leave and forecasts without exporting account or session fields', () => {
    const report = configuredReport();
   
    report.settings.openingPto = -4.25;
    report.entries = [{ id: 'pto', date: '2026-10-05', category: 'pto', hours: 8, notes: 'Vacation' }];
    report.projectedWork = { '2026-11': 120.5 };
    const periods = [{ ...samplePeriods()[0], name: 'Edited POP', targetHours: 345.6 }];
    const exported = exportTimesheetJson([{ ...log, user_id: 'private-account', access_token: 'private-session' } as typeof log], { ...report, refresh_token: 'private-refresh' } as typeof report, 'personal', periods);
    expect(exported).not.toContain('private-');
    expect(parseTimesheetJson(exported)).toEqual({ logs: [log], report, periods, dataset: 'personal' });
    expect(JSON.parse(exported).version).toBe(3);
  });
  it('accepts older log arrays and database rows, preserves zero hours and strips spoofed owners', () => {
    const parsed = parseTimesheetJson('\uFEFF' + JSON.stringify([{ date: '2026-10-01', total_hours: 0, notes: null, user_id: 'other-user' }]));
    expect(parsed.logs[0]).toMatchObject({ date: '2026-10-01', totalHours: 0, notes: undefined });
    expect(parsed.logs[0]).not.toHaveProperty('user_id');
    expect(parsed.report).toBeNull();
  });
  it('rejects malformed files, unsupported formats, invalid dates, hours and duplicate dates', () => {
    for (const file of ['broken', '{}', 'null', JSON.stringify({ format: 'other', logs: [] }), JSON.stringify({ version: 2, logs: [] }),
      JSON.stringify([{ ...log, date: '2026-02-30' }]), JSON.stringify([{ ...log, totalHours: 25 }]), JSON.stringify([{ ...log, totalHours: '8' }]),
      JSON.stringify([log, log]), JSON.stringify([{ ...log, notes: {} }])]) {
      expect(() => parseTimesheetJson(file)).toThrow();
    }
  });
  it('validates the complete report, including leave categories, months and finite numbers', () => {
    const report = configuredReport();
    for (const invalid of [
      { ...report, settings: { ...report.settings, workPercent: 201 } },
      { ...report, settings: { ...report.settings, openingPto: null } },
      { ...report, entries: [{ id: 'a', date: '2026-10-01', category: 'unknown', hours: 8 }] },
      { ...report, entries: [{ id: 'a', date: '2026-10-01', category: 'pto', hours: -1 }] },
      { ...report, projectedWork: { '2026-13': 8 } },
      { ...report, projectedWork: { '2026-10': '8' } },
      { ...report, projectedWork: null },
    ]) expect(() => parseTimesheetJson(JSON.stringify({ logs: [log], report: invalid }))).toThrow();
  });
  it('exports only saved inputs, drops old birthday-month settings, and rejects invalid POPs', () => {
    const state = configuredReport();
    Object.assign(state.settings, { birthdayMonth: 5 });
    Object.assign(state, { monthlyBalances: { pto: 999 }, accruedPto: 888 });
    const exported = exportTimesheetJson([log], state, 'personal', samplePeriods());
    expect(exported).not.toMatch(/birthdayMonth|monthlyBalances|accruedPto/);
    for (const periods of [[{ ...samplePeriods()[0], endDate: '2024-01-01' }], [samplePeriods()[0], samplePeriods()[0]], [{ ...samplePeriods()[0], targetHours: -1 }]]) {
      expect(() => parseTimesheetJson(JSON.stringify({ logs: [], periods }))).toThrow('POP');
    }
    expect(parseTimesheetJson(JSON.stringify({ logs: [], periods: [] })).periods).toEqual([]);
  });
});


it('ignores historical inference flags in old JSON without creating or modifying leave entries', () => {
  const state = configuredReport(2026);
  Object.assign(state.settings, { autoPto: true });
  const contents = JSON.stringify({ logs: [log], report: state });
  const restored = parseTimesheetJson(contents).report!;
  expect(restored.entries).toEqual([]);
  expect(restored.settings).not.toHaveProperty('autoPto');
  expect(exportTimesheetJson([log], state, 'personal', [])).not.toContain('autoPto');
});


it('includes exact rate precision and an explicitly empty POP list in complete backups', () => {
  const state = configuredReport(2035);
  state.settings.ptoAccrualRate = 0.12345678;
  const contents = exportTimesheetJson([log], state, 'personal', []);
  expect(JSON.parse(contents).version).toBe(3);
  expect(parseTimesheetJson(contents).report?.settings.ptoAccrualRate).toBe(0.12345678);
  expect(parseTimesheetJson(contents).periods).toEqual([]);
});

it('accepts legacy backups without inventing a PTO rate, but requires the rate in current backups', () => {
  const state = configuredReport(2035);
  const { ptoAccrualRate: _rate, ...settings } = state.settings;
  for (const version of [undefined, 1, 2]) {
    const parsed = parseTimesheetJson(JSON.stringify({ version, logs: [log], report: { ...state, settings }, periods: [] }));
    expect(parsed.report?.settings.ptoAccrualRate).toBeNull();
  }
  expect(() => parseTimesheetJson(JSON.stringify({ version: 3, logs: [log], report: { ...state, settings }, periods: [] }))).toThrow('PTO accrual rate');
  state.settings.ptoAccrualRate = null;
  expect(() => exportTimesheetJson([], state, 'personal', [])).toThrow('Set a PTO accrual rate');
});

it.each([-0.1, 1.1, 0.123456789, '0.125'])('rejects an invalid backup rate before restore: %s', rate => {
  const state = configuredReport(2035);
  const report = { ...state, settings: { ...state.settings, ptoAccrualRate: rate } };
  expect(() => parseTimesheetJson(JSON.stringify({ version: 3, logs: [], report, periods: [] }))).toThrow('PTO accrual rate');
});
