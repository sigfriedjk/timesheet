import { describe, expect, it } from 'vitest';
import { createDefaultMonthlyReport } from '../services/monthlyReport';
import { TimeLog } from '../types';
import { createSampleTimeLogs2026 } from '../services/sampleData';
import { buildMonthlySummary, getMonthlySummaryRange } from './monthlySummary';

const log = (date: string, totalHours: number): TimeLog => ({
  id: date,
  date,
  totalHours,
  createdAt: `${date}T18:00:00Z`,
  updatedAt: `${date}T18:00:00Z`,
});
const sample = createSampleTimeLogs2026();
const configuredReport = (year: number) => {
  const state = createDefaultMonthlyReport(year);
  state.settings.ptoAccrualRate = 0.125; // Fictional test rate.
  return state;
};

describe('Monthly work and leave summary', () => {
  it('shows a continuous all-years range from every saved input through the forecast horizon', () => {
    const state = configuredReport(2025);
    state.entries = [{ id: 'early-leave', date: '2024-11-10', category: 'pto', hours: 2 }];
    state.projectedWork = { '2027-03': 100 };
    const logs = [log('2025-01-02', 8), log('2026-01-02', 7)];
    expect(getMonthlySummaryRange(logs, state, '2026-10-22')).toEqual({
      firstMonth: '2024-11',
      lastMonth: '2027-12',
      years: [2024, 2025, 2026, 2027],
    });
    const all = buildMonthlySummary(logs, state, 'all', '2026-10-22');
    expect(all.rows).toHaveLength(38);
    expect(new Set(all.rows.map((row) => row.key)).size).toBe(38);
    expect(all.rows[0]).toMatchObject({ key: '2024-11', balance: null });
    expect(all.rows[all.rows.length - 1].key).toBe('2027-12');
    expect(all.rows.find((row) => row.key === '2025-02')?.actualHours).toBe(0);
    expect(all.totals.actualHours).toBe(15);
    const current = buildMonthlySummary(logs, state, 2026, '2026-10-22');
    expect(all.currentBalance).toEqual(current.currentBalance);
    expect(all.rows.find((row) => row.key === '2026-01')).toEqual(current.rows[0]);
    expect(all.yearEndBalance).toEqual(
      buildMonthlySummary(logs, state, 2027, '2026-10-22').yearEndBalance,
    );
  });

  it('includes earlier logs and future leave, and provides a useful range without any entries', () => {
    const state = configuredReport(2026);
    expect(getMonthlySummaryRange([], state, '2026-10-22')).toEqual({
      firstMonth: '2026-01',
      lastMonth: '2026-12',
      years: [2026],
    });
    expect(buildMonthlySummary([], state, 'all', '2026-10-22').rows).toHaveLength(12);
    state.entries = [{ id: 'future-leave', date: '2028-02-01', category: 'pto', hours: 8 }];
    expect(getMonthlySummaryRange([log('2025-01-02', 8)], state, '2026-10-22')).toEqual({
      firstMonth: '2025-01',
      lastMonth: '2028-12',
      years: [2025, 2026, 2027, 2028],
    });
  });

  it('calculates accruals without inventing historical leave usage', () => {
    const state = configuredReport(2026);
    const jan = buildMonthlySummary(sample, state, 2026, '2026-10-20').rows[0];
    expect(jan).toMatchObject({
      weekdayHours: 176,
      holidayCount: 2,
      actualHours: 150.3,
      workHours: 150.3,
      leaveNeeded: 25.7,
      accruedPto: 18.79,
      accruedHoliday: 16,
      accruedBirthday: 8,
      usedPto: 0,
      usedHoliday: 0,
    });
    expect(jan.balance).toEqual({ pto: 18.79, holiday: 16, birthday: 8, total: 42.79 });
    expect(buildMonthlySummary(sample, state, 2026, '2026-10-20').rows[6].holidayCount).toBe(1);
  });

  it('keeps recorded work and current leave separate from future projections and does not mutate logs', () => {
    const state = configuredReport(2026);
    const before = JSON.stringify(sample);
    const report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.totals.actualHours).toBe(1210.7);
    expect(report.totals.workHours).toBe(1210.7);
    expect(report.rows[9]).toMatchObject({
      projected: true,
      actualHours: 97.8,
      workHours: 97.8,
      remainingHours: 0,
    });
    expect(report.rows[10]).toMatchObject({
      actualHours: 0,
      workHours: 0,
      accruedPto: 0,
      usedPto: 0,
    });
    expect(JSON.stringify(sample)).toBe(before);
    state.projectedWork['2026-11'] = 0;
    const changed = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(changed.rows[10]).toMatchObject({ workHours: 0, accruedPto: 0, usedPto: 0 });
    expect(changed.currentBalance).toEqual(report.currentBalance);
    expect(changed.yearEndBalance).toEqual(report.yearEndBalance);
  });

  it('never fills historical gaps, even with a legacy auto-PTO flag, and never invents future leave', () => {
    const state = configuredReport(2026);
    Object.assign(state.settings, { autoPto: true });
    state.entries = [{ id: 'entered', date: '2026-01-09', category: 'pto', hours: 2.5 }];
    const before = JSON.stringify({ state, sample });
    const report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.rows[0]).toMatchObject({ usedPto: 2.5, usedHoliday: 0 });
    expect(report.rows[1]).toMatchObject({ usedPto: 0, usedHoliday: 0 });
    expect(report.rows[10].usedPto).toBe(0);
    expect(JSON.stringify({ state, sample })).toBe(before);
  });

  it('accounts for dated usage and signed PTO adjustments while retaining separate balances', () => {
    const state = configuredReport(2026);
    state.entries = [
      { id: 'pto', date: '2026-01-09', category: 'pto', hours: 20 },
      { id: 'adj', date: '2026-01-31', category: 'adjustment', hours: -0.02 },
      { id: 'holiday', date: '2026-01-31', category: 'holiday', hours: 0 },
      { id: 'birthday', date: '2026-01-23', category: 'birthday', hours: 2 },
    ];
    const jan = buildMonthlySummary(sample, state, 2026, '2026-10-20').rows[0];
    expect(jan.balance).toEqual({ pto: -1.23, holiday: 16, birthday: 6, total: 20.77 });
  });

  it('uses future-dated work and entered planned leave without changing current balances', () => {
    const state = configuredReport(2026);
    const baseline = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    const withPlan = buildMonthlySummary(
      [...sample, log('2026-10-21', 10)],
      state,
      2026,
      '2026-10-20',
    );
    expect(withPlan.totals.actualHours).toBe(baseline.totals.actualHours);
    expect(withPlan.rows[9].workHours).toBe(107.8);
    expect(withPlan.currentBalance).toEqual(baseline.currentBalance);
    state.entries.push({ id: 'vacation', date: '2026-11-02', category: 'pto', hours: 8 });
    const vacation = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(vacation.rows[10].workHours).toBe(0);
    expect(vacation.rows[10].usedPto).toBe(8);
    expect(vacation.currentBalance).toEqual(baseline.currentBalance);
  });

  it('ignores legacy monthly overrides and rates without changing entered data', () => {
    const state = configuredReport(2026);
    state.projectedWork = { '2026-01': 0, '2026-10': 50, '2026-11': 144 };
    const report = buildMonthlySummary(sample, state, 2026, '2026-10-20');
    expect(report.rows[0].workHours).toBe(150.3);
    expect(report.rows[9].workHours).toBe(97.8);
    expect(report.rows[10]).toMatchObject({ workHours: 0, usedPto: 0, accruedPto: 0 });
  });

  it('carries balances across year boundaries and always credits birthday leave in January', () => {
    const state = configuredReport(2025);
    state.settings = {
      ...state.settings,
      openingMonth: '2025-12',
      openingPto: 100,
      openingHoliday: 10,
      openingBirthday: 5,
    };
    const report = buildMonthlySummary(
      [log('2025-12-01', 8), log('2026-01-02', 8)],
      state,
      2026,
      '2026-01-31',
    );
    expect(report.currentBalance).toEqual({ pto: 102, holiday: 34, birthday: 13, total: 149 });
    Object.assign(state.settings, { birthdayMonth: 5 }); // Old backups cannot change the January policy.
    const mayBirthday = buildMonthlySummary([], state, 2026, '2026-05-01');
    expect(mayBirthday.rows[0].accruedBirthday).toBe(8);
    expect(mayBirthday.rows[4].accruedBirthday).toBe(0);
    expect(mayBirthday.currentBalance!.birthday).toBe(13);
  });

  it('uses true trailing windows across years and includes empty tracked months instead of dropping them', () => {
    const state = configuredReport(2025);
    const logs = Array.from({ length: 24 }, (_, index) =>
      log(`${2025 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-02`, 8),
    );
    const dec = buildMonthlySummary(logs, state, 2026, '2026-12-31').rows[11];
    expect(dec).toMatchObject({ rollingMonths: 12, rollingTotal: 96, rollingAverage: 8 });
    const noFebruary = logs.filter((entry) => !entry.date.startsWith('2026-02'));
    const emptyMonth = buildMonthlySummary(noFebruary, state, 2026, '2026-12-31').rows[11];
    expect(emptyMonth).toMatchObject({ rollingMonths: 12, rollingTotal: 88, rollingAverage: 7.3 });
    const partial = buildMonthlySummary(sample, configuredReport(2026), 2026, '2026-10-20');
    expect(partial.rows[0]).toMatchObject({ rollingMonths: 1, rollingAverage: 150.3 });
    expect(partial.rolling).toMatchObject({ months: 9, total: 1112.9, average: 123.7 });
    expect(partial.rows[11].rollingMonths).toBe(12);
  });

  it('returns unknown balances before the configured opening month and adds credits only once', () => {
    const state = configuredReport(2026);
    state.settings.openingMonth = '2027-01';
    expect(buildMonthlySummary(sample, state, 2026, '2026-10-20').yearEndBalance).toBeNull();
    const regular = buildMonthlySummary([], configuredReport(2026), 2026, '2026-12-31');
    expect(regular.totals.accruedHoliday).toBe(88);
    expect(regular.totals.accruedBirthday).toBe(8);
    expect(regular.currentBalance).toEqual({ pto: 0, holiday: 88, birthday: 8, total: 96 });
    expect(regular.yearEndBalance).toEqual(regular.rows[11].balance);
  });
});

it('anchors monthly cards to today across year filters and January boundaries', () => {
  const state = configuredReport(2025);
  state.settings.openingMonth = '2025-12';
  state.settings.openingPto = 100;
  const logs = [log('2025-12-02', 8), log('2026-01-02', 7)];
  const before = JSON.stringify({ state, logs });
  const all = buildMonthlySummary(logs, state, 'all', '2026-01-22');
  expect(all.previousMonth.key).toBe('2025-12');
  expect(all.currentMonth.key).toBe('2026-01');
  for (const year of [2024, 2025, 2026, 2027]) {
    const selected = buildMonthlySummary(logs, state, year, '2026-01-22');
    expect(selected.previousMonth).toEqual(all.previousMonth);
    expect(selected.currentMonth).toEqual(all.currentMonth);
  }
  expect(JSON.stringify({ state, logs })).toBe(before);
  const unopened = buildMonthlySummary([], configuredReport(2029), 'all', '2026-01-22');
  expect(unopened.previousMonth.actualBalance).toBeNull();
  expect(unopened.currentMonth.key).toBe('2026-01');
});

it('preserves separate recorded and planned rounding within each month', () => {
  const state = configuredReport(2026);
  state.settings.openingMonth = '2026-10';
  state.entries = [
    { id: 'pto-actual', date: '2026-10-23', category: 'pto', hours: 0.006 },
    { id: 'pto-future', date: '2026-10-24', category: 'pto', hours: 0.006 },
    { id: 'adjustment-actual', date: '2026-10-23', category: 'adjustment', hours: -0.006 },
    { id: 'adjustment-future', date: '2026-10-24', category: 'adjustment', hours: 0.006 },
    { id: 'next-month', date: '2026-11-01', category: 'pto', hours: 20 },
  ];
  const report = buildMonthlySummary(
    [log('2026-11-01', 8), log('2026-10-24', 0.04), log('2026-10-23', 8.04), log('2026-09-30', 8)],
    state,
    'all',
    '2026-10-23',
  );
  expect(report.currentMonth).toMatchObject({
    actualHours: 8,
    workHours: 8,
    remainingHours: 0,
    usedPto: 0.02,
    adjustment: 0,
    actualBalance: { pto: 0.98 },
    balance: { pto: 0.98 },
  });
  expect(report.rows.find((row) => row.key === '2026-11')).toMatchObject({
    workHours: 8,
    usedPto: 20,
  });
});

it('uses each account rate and distinguishes an unconfigured rate from an explicit zero', () => {
  const a = configuredReport(2035);
  const b = configuredReport(2035);
  b.settings.ptoAccrualRate = 0.25;
  const logs = [log('2035-02-05', 8)];
  expect(buildMonthlySummary(logs, a, 2035, '2035-02-28').rows[1].accruedPto).toBe(1);
  expect(buildMonthlySummary(logs, b, 2035, '2035-02-28').rows[1].accruedPto).toBe(2);
  b.settings.ptoAccrualRate = null;
  const unconfigured = buildMonthlySummary(logs, b, 2035, '2035-02-28');
  expect(unconfigured.rateConfigured).toBe(false);
  expect(unconfigured.rows[1]).toMatchObject({
    workHours: 8,
    accruedPto: null,
    balance: null,
    actualBalance: null,
  });
  expect(unconfigured.totals.accruedPto).toBeNull();
  b.settings.ptoAccrualRate = 0;
  const zero = buildMonthlySummary(logs, b, 2035, '2035-02-28');
  expect(zero.rateConfigured).toBe(true);
  expect(zero.rows[1].accruedPto).toBe(0);
  expect(zero.rows[1].balance?.pto).toBe(0);
});
