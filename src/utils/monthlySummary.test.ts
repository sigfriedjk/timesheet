import { describe, expect, it } from 'vitest';
import { TimeLog } from '../types';
import { createSampleTimeLogs2026 } from '../services/sampleData';
import { buildMonthlySummary, createDefaultMonthlyReport, getMonthlySummaryRange } from './monthlySummary';

const log = (date: string, totalHours: number): TimeLog => ({ id: date, date, totalHours, createdAt: `${date}T18:00:00Z`, updatedAt: `${date}T18:00:00Z` });
const sample = createSampleTimeLogs2026();

describe('Monthly work and leave summary', () => {
  it('shows a continuous all-years range from every saved input through the forecast horizon', () => {
    const state = createDefaultMonthlyReport(2025);
    state.entries = [{ id: 'early-leave', date: '2024-11-10', category: 'pto', hours: 2 }];
    state.projectedWork = { '2027-03': 100 };
    const logs = [log('2025-01-02', 8), log('2026-01-02', 7)];
    expect(getMonthlySummaryRange(logs, state, '2026-10-22')).toEqual({ firstMonth: '2024-11', lastMonth: '2027-12', years: [2024, 2025, 2026, 2027] });
    const all = buildMonthlySummary(logs, state, 'all', '2026-10-22');
    expect(all.rows).toHaveLength(38);
    expect(new Set(all.rows.map(row => row.key)).size).toBe(38);
    expect(all.rows[0]).toMatchObject({ key: '2024-11', balance: null });
    expect(all.rows[all.rows.length - 1].key).toBe('2027-12');
    expect(all.rows.find(row => row.key === '2025-02')?.actualHours).toBe(0);
    expect(all.totals.actualHours).toBe(15);
    const current = buildMonthlySummary(logs, state, 2026, '2026-10-22');
    expect(all.currentBalance).toEqual(current.currentBalance);
    expect(all.rows.find(row => row.key === '2026-01')).toEqual(current.rows[0]);
    expect(all.yearEndBalance).toEqual(buildMonthlySummary(logs, state, 2027, '2026-10-22').yearEndBalance);
  });

  it('includes earlier logs and future leave, and provides a useful range without any entries', () => {
    const state = createDefaultMonthlyReport(2026);
    expect(getMonthlySummaryRange([], state, '2026-10-22')).toEqual({ firstMonth: '2026-01', lastMonth: '2026-12', years: [2026] });
    expect(buildMonthlySummary([], state, 'all', '2026-10-22').rows).toHaveLength(12);
    state.entries = [{ id: 'future-leave', date: '2028-02-01', category: 'pto', hours: 8 }];
    expect(getMonthlySummaryRange([log('2025-01-02', 8)], state, '2026-10-22')).toEqual({ firstMonth: '2025-01', lastMonth: '2028-12', years: [2025, 2026, 2027, 2028] });
  });

  it('matches the sheet weekday/credit/PTO formulas without double counting holidays', () => {
    const state = createDefaultMonthlyReport(2026);
    const jan = buildMonthlySummary(sample, state, 2026, '2026-10-20').rows[0];
    expect(jan).toMatchObject({ weekdayHours: 176, holidayCount: 2, actualHours: 150.3, workHours: 150.3,
      leaveNeeded: 25.7, accruedPto: 12.79, accruedHoliday: 16, accruedBirthday: 8, usedPto: 17.7, usedHoliday: 8 });
    expect(jan.balance).toEqual({ pto: -4.91, holiday: 8, birthday: 8, total: 11.09 });
    expect(buildMonthlySummary(sample, state, 2026, '2026-10-20').rows[6].holidayCount).toBe(1);
  });

  it('keeps recorded work and current leave separate from future projections and does not mutate logs', () => {
    const state = createDefaultMonthlyReport(2026);
    const before = JSON.stringify(sample);
    const report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.totals.actualHours).toBe(1210.7);
    expect(report.totals.workHours).toBe(1580.4);
    expect(report.rows[9]).toMatchObject({ projected: true, actualHours: 97.8, workHours: 158.2, remainingHours: 60.4 });
    expect(report.rows[10]).toMatchObject({ actualHours: 0, workHours: 143.3, accruedPto: 12.19, usedPto: 8.7 });
    expect(JSON.stringify(sample)).toBe(before);
    state.projectedWork['2026-11'] = 0;
    const changed = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(changed.rows[10]).toMatchObject({ workHours: 0, accruedPto: 0, usedPto: 152 });
    expect(changed.currentBalance).toEqual(report.currentBalance);
    expect(changed.yearEndBalance!.total).toBeLessThan(report.yearEndBalance!.total);
  });

  it('defaults to automatic historical PTO gaps, including empty months, with explicit entries overriding them', () => {
    const state = createDefaultMonthlyReport(2026);
    expect(state.settings.autoPto).toBe(true);
    let report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.rows[0].usedPto).toBe(17.7);
    expect(report.rows[1]).toMatchObject({ actualHours: 0, usedPto: 152 });
    state.entries.push({ id: 'override', date: '2026-01-31', category: 'pto', hours: 0 });
    report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.rows[0].usedPto).toBe(0);
  });

  it('supports explicitly disabling historical PTO gap-filling without changing future estimates', () => {
    const state = createDefaultMonthlyReport(2026);
    state.settings.autoPto = false;
    const report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.rows[0].usedPto).toBe(0);
    expect(report.rows[1].usedPto).toBe(0);
    expect(report.rows[10].usedPto).toBe(8.7);
  });

  it('accounts for dated usage and signed PTO adjustments while retaining separate balances', () => {
    const state = createDefaultMonthlyReport(2026);
    state.entries = [
      { id: 'pto', date: '2026-01-09', category: 'pto', hours: 20 },
      { id: 'adj', date: '2026-01-31', category: 'adjustment', hours: -0.02 },
      { id: 'holiday', date: '2026-01-31', category: 'holiday', hours: 0 },
      { id: 'birthday', date: '2026-01-23', category: 'birthday', hours: 2 },
    ];
    const jan = buildMonthlySummary(sample, state, 2026, '2026-10-20').rows[0];
    expect(jan.balance).toEqual({ pto: -7.23, holiday: 16, birthday: 6, total: 14.77 });
  });

  it('replaces daily forecasts with future-dated logs and deducts planned leave without changing current balances', () => {
    const state = createDefaultMonthlyReport(2026);
    const baseline = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    const withPlan = buildMonthlySummary([...sample, log('2026-10-21', 10)], state, 2026, '2026-10-20');
    expect(withPlan.totals.actualHours).toBe(baseline.totals.actualHours);
    expect(withPlan.rows[9].workHours).toBe(160.6);
    expect(withPlan.currentBalance).toEqual(baseline.currentBalance);
    state.entries.push({ id: 'vacation', date: '2026-11-02', category: 'pto', hours: 8 });
    const vacation = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(vacation.rows[10].workHours).toBe(135.8);
    expect(vacation.rows[10].usedPto).toBe(16.2);
    expect(vacation.currentBalance).toEqual(baseline.currentBalance);
  });

  it('honors monthly forecast overrides including zero and never replaces historical actuals', () => {
    const state = createDefaultMonthlyReport(2026);
    state.projectedWork = { '2026-01': 0, '2026-10': 50, '2026-11': 144 };
    const report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.rows[0].workHours).toBe(150.3);
    expect(report.rows[9].workHours).toBe(97.8);
    expect(report.rows[10]).toMatchObject({ workHours: 144, usedPto: 8, accruedPto: 12.25 });
  });

  it('carries balances across year boundaries and always credits birthday leave in January', () => {
    const state = createDefaultMonthlyReport(2025);
    state.settings = { ...state.settings, openingMonth: '2025-12', openingPto: 100, openingHoliday: 10, openingBirthday: 5 };
    const report = buildMonthlySummary([log('2025-12-01', 8), log('2026-01-02', 8)], state, 2026, '2026-01-31');
    expect(report.currentBalance).toEqual({ pto: -218.64, holiday: 10, birthday: 13, total: -195.64 });
    Object.assign(state.settings, { birthdayMonth: 5 }); // Old backups cannot change the January policy.
    const mayBirthday = buildMonthlySummary([], state, 2026, '2026-05-01');
    expect(mayBirthday.rows[0].accruedBirthday).toBe(8);
    expect(mayBirthday.rows[4].accruedBirthday).toBe(0);
    expect(mayBirthday.currentBalance!.birthday).toBe(13);
  });

  it('uses true trailing windows across years and includes empty tracked months instead of dropping them', () => {
    const state = createDefaultMonthlyReport(2025);
    const logs = Array.from({ length: 24 }, (_, index) => log(`${2025 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}-02`, 8));
    const dec = buildMonthlySummary(logs, state, 2026, '2026-12-31').rows[11];
    expect(dec).toMatchObject({ rollingMonths: 12, rollingTotal: 96, rollingAverage: 8 });
    const noFebruary = logs.filter(entry => !entry.date.startsWith('2026-02'));
    const emptyMonth = buildMonthlySummary(noFebruary, state, 2026, '2026-12-31').rows[11];
    expect(emptyMonth).toMatchObject({ rollingMonths: 12, rollingTotal: 88, rollingAverage: 7.3 });
    const partial = buildMonthlySummary(sample, createDefaultMonthlyReport(2026), 2026, '2026-10-20');
    expect(partial.rows[0]).toMatchObject({ rollingMonths: 1, rollingAverage: 150.3 });
    expect(partial.rolling).toMatchObject({ months: 9, total: 1112.9, average: 123.7 });
    expect(partial.rows[11].rollingMonths).toBe(12);
  });

  it('returns unknown balances before the configured opening month and adds credits only once', () => {
    const state = createDefaultMonthlyReport(2026);
    state.settings.openingMonth = '2027-01';
    expect(buildMonthlySummary(sample, state, 2026, '2026-10-20').yearEndBalance).toBeNull();
    const regular = buildMonthlySummary([], createDefaultMonthlyReport(2026), 2026, '2026-12-31');
    expect(regular.totals.accruedHoliday).toBe(88);
    expect(regular.totals.accruedBirthday).toBe(8);
    expect(regular.currentBalance).toEqual({ pto: -2000, holiday: 0, birthday: 8, total: -1992 });
    expect(regular.yearEndBalance).toEqual(regular.rows[11].balance);
  });
});
