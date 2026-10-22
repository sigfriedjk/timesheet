import { describe, expect, it } from 'vitest';
import { exportTimesheetJson, parseTimesheetJson } from './jsonBackup';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';

const log = { id: 'a', date: '2026-10-01', totalHours: 8.1, notes: 'Worked', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z' };
describe('JSON timesheet backups', () => {
  it('round trips entries, opt-outs, leave and forecasts without exporting account or session fields', () => {
    const report = createDefaultMonthlyReport();
    report.settings.autoPto = false;
    report.settings.openingPto = -4.25;
    report.entries = [{ id: 'pto', date: '2026-10-05', category: 'pto', hours: 8, notes: 'Vacation' }];
    report.projectedWork = { '2026-11': 120.5 };
    const exported = exportTimesheetJson([{ ...log, user_id: 'private-account', access_token: 'private-session' } as typeof log], { ...report, refresh_token: 'private-refresh' } as typeof report, 'personal');
    expect(exported).not.toContain('private-');
    expect(parseTimesheetJson(exported)).toEqual({ logs: [log], report, dataset: 'personal' });
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
    const report = createDefaultMonthlyReport();
    for (const invalid of [
      { ...report, settings: { ...report.settings, workPercent: 201 } },
      { ...report, settings: { ...report.settings, openingPto: null } },
      { ...report, settings: { ...report.settings, birthdayMonth: 1.5 } },
      { ...report, entries: [{ id: 'a', date: '2026-10-01', category: 'unknown', hours: 8 }] },
      { ...report, entries: [{ id: 'a', date: '2026-10-01', category: 'pto', hours: -1 }] },
      { ...report, projectedWork: { '2026-13': 8 } },
      { ...report, projectedWork: { '2026-10': '8' } },
      { ...report, projectedWork: null },
    ]) expect(() => parseTimesheetJson(JSON.stringify({ logs: [log], report: invalid }))).toThrow();
  });
});
