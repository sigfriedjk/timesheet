import { describe, expect, it } from 'vitest';
import { PeriodOfPerformance, TimeLog } from '../types';
import { POP_PERIODS } from '../config/periodsOfPerformance';
import { createSampleTimeLogs2026 } from '../services/sampleData';
import { buildPopSummary } from './popSummary';

const log = (date: string, totalHours: number): TimeLog => ({ id: date, date, totalHours, createdAt: `${date}T18:00:00Z`, updatedAt: `${date}T18:00:00Z` });
const period = (startDate: string, endDate: string, targetHours: number): PeriodOfPerformance => ({ id: startDate, name: 'Test POP', startDate, endDate, targetHours });

describe('POP summary', () => {
  it('matches all 24 reference weekday counts and uses contiguous, inclusive ranges named A–X', () => {
    const report = buildPopSummary([], POP_PERIODS, '2026-10-20');
    expect(report.rows.map(row => row.weekdays)).toEqual([47, 89, 21, 35, 22, 29, 22, 43, 44, 8, 37, 20, 23, 42, 22, 65, 98, 34, 21, 20, 23, 22, 21, 22]);
    expect(POP_PERIODS.map(row => row.name)).toEqual(Array.from({ length: 24 }, (_, i) => `POP ${String.fromCharCode(65 + i)}`));
    expect(POP_PERIODS[0].startDate).toBe('2024-04-25');
    expect(POP_PERIODS[23].endDate).toBe('2027-06-30');
    for (let i = 1; i < POP_PERIODS.length; i++) {
      const next = new Date(`${POP_PERIODS[i - 1].endDate}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      expect(POP_PERIODS[i].startDate).toBe(next.toISOString().slice(0, 10));
    }
  });

  it('matches sample year totals and funding without importing worked values from the sheet', () => {
    const logs = createSampleTimeLogs2026();
    const before = JSON.stringify(logs);
    const report = buildPopSummary(logs, POP_PERIODS, '2026-10-20', 2026);
    expect(report.rows.map(row => row.name)).toEqual(['POP N', 'POP O', 'POP P', 'POP Q', 'POP R']);
    expect(report.totals).toMatchObject({ weekdays: 261, weekdayHours: 2088, targetHours: 1915, workedHours: 1210.7, remainingHours: 704.3 });
    expect(report.rows[0]).toMatchObject({ workedHours: 150.3, remainingHours: 161.7, status: 'Completed' });
    expect(report.rows[3].status).toBe('Active');
    expect(report.rows[4]).toMatchObject({ status: 'Upcoming', workedHours: 0 });
    expect(JSON.stringify(logs)).toBe(before);
  });

  it('assigns boundary, weekend, and holiday work once and includes future forecasts and excludes out-of-range logs', () => {
    const logs = [log('2024-11-30', 5), log('2024-12-01', 6), log('2025-01-01', 7), log('2025-01-17', 8), log('2025-01-18', 9), log('2025-02-18', 10), log('2025-02-19', 11)];
    const result = buildPopSummary(logs, POP_PERIODS.slice(3, 5), '2025-02-18');
    expect(result.rows.map(row => row.workedHours)).toEqual([21, 19]);
    expect(result.totals.workedHours).toBe(40);
    const earlier = buildPopSummary(logs, POP_PERIODS.slice(3, 5), '2025-01-17');
    expect(earlier.rows[1]).toMatchObject({ workedHours: 19, actualHours: 0, forecastHours: 19 });
    expect(earlier.rows[1].status).toBe('Upcoming');
  });

  it('includes the full cross-year period in either year instead of truncating its hours or funding', () => {
    const logs = [log('2024-12-02', 8), log('2025-01-02', 7)];
    for (const year of [2024, 2025]) {
      const report = buildPopSummary(logs, POP_PERIODS.slice(3, 4), '2025-01-17', year);
      expect(report.rows).toHaveLength(1);
      expect(report.rows[0]).toMatchObject({ weekdayHours: 280, targetHours: 252, workedHours: 15 });
    }
    expect(buildPopSummary(logs, POP_PERIODS.slice(3, 4), '2026-10-20', 2026).rows).toEqual([]);
  });

  it('uses a weighted total funded percentage, preserves overruns, and handles zero-weekday ranges', () => {
    const report = buildPopSummary([log('2026-03-02', 10)], [period('2026-03-02', '2026-03-03', 8), period('2026-03-04', '2026-03-04', 8)], '2026-03-31');
    expect(report.rows.map(row => row.fundedPercent)).toEqual([50, 100]);
    expect(report.totals.fundedPercent).toBeCloseTo(66.6667, 4);
    expect(report.rows[0].remainingHours).toBe(-2);
    const weekend = buildPopSummary([], [period('2026-03-07', '2026-03-08', 0)], '2026-03-31');
    expect(weekend.rows[0].fundedPercent).toBeNull();
    expect(weekend.totals.fundedPercent).toBeNull();
    expect(buildPopSummary([], [], '2026-03-31').totals.workedHours).toBe(0);
  });

  it('counts leap-day and daylight-saving ranges consistently and rejects reversed ranges', () => {
    const leap = buildPopSummary([], [period('2024-02-28', '2024-03-01', 24)], '2024-03-31');
    expect(leap.rows[0].weekdays).toBe(3);
    const dst = buildPopSummary([], [period('2026-03-07', '2026-03-09', 8)], '2026-03-31');
    expect(dst.rows[0].weekdays).toBe(1);
    expect(() => buildPopSummary([], [period('2026-03-09', '2026-03-07', 0)], '2026-03-31')).toThrow('Invalid range');
  });
});

it('sums complete July–June POPs for the year card and uses the active table row for the POP card', async () => {
  const { buildCurrentPopCards } = await import('./popSummary');
  const logs = [log('2026-06-30', 20), log('2026-07-01', 9), log('2026-10-23', 7), log('2026-11-02', 6), log('2027-06-30', 3), log('2027-07-01', 20)];
  const before = JSON.stringify(logs);
  const result = buildCurrentPopCards(logs, POP_PERIODS, '2026-10-23');
  const yearPeriods = POP_PERIODS.filter(pop => pop.startDate >= '2026-07-01' && pop.endDate <= '2027-06-30');
  const funded = yearPeriods.reduce((sum, pop) => sum + pop.targetHours, 0);
  expect(result.current).toMatchObject({ name: 'POP Q', funded: 708, worked: 22, available: 686 });
  expect(result.year).toEqual({ startDate: '2026-07-01', endDate: '2027-06-30', funded, worked: 25, available: funded - 25 });
  expect(buildCurrentPopCards([], POP_PERIODS, '2027-06-30').year.startDate).toBe('2026-07-01');
  expect(buildCurrentPopCards([], POP_PERIODS, '2026-07-01').year.startDate).toBe('2026-07-01');
  expect(buildCurrentPopCards([], [], '2026-10-23').current).toBeNull();
  expect(JSON.stringify(logs)).toBe(before);
});
