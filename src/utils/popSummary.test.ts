import { describe, expect, it } from 'vitest';
import { PeriodOfPerformance, TimeLog } from '../types';
import { buildCurrentPopCards, buildPopSummary, currentPopCards } from './popSummary';

const log = (date: string, totalHours: number): TimeLog => ({
  id: date,
  date,
  totalHours,
  createdAt: `${date}T18:00:00Z`,
  updatedAt: `${date}T18:00:00Z`,
});
const period = (startDate: string, endDate: string, targetHours: number): PeriodOfPerformance => ({
  id: startDate,
  name: 'Fictional test phase',
  startDate,
  endDate,
  targetHours,
});

describe('POP summary with fictional schedules', () => {
  it('counts weekdays while including weekend work in the saved total', () => {
    const periods = [period('2026-03-02', '2026-03-08', 25.75)];
    const logs = [log('2026-03-02', 4.1), log('2026-03-06', 3.2), log('2026-03-07', 2)];
    const before = structuredClone({ logs, periods });
    const report = buildPopSummary(logs, periods, '2026-03-06');
    expect(report.rows[0]).toMatchObject({
      weekdays: 5,
      weekdayHours: 40,
      targetHours: 25.75,
      workedHours: 9.3,
      actualHours: 7.3,
      forecastHours: 2,
      remainingHours: 16.5,
      status: 'Active',
    });
    expect(report.rows[0].fundedPercent).toBe(64.375);
    expect({ logs, periods }).toEqual(before);
  });

  it('assigns inclusive boundaries once and excludes out-of-range dates', () => {
    const periods = [
      period('2026-03-02', '2026-03-03', 10),
      period('2026-03-04', '2026-03-08', 21.5),
    ];
    const logs = [
      log('2026-03-01', 9),
      log('2026-03-03', 3),
      log('2026-03-04', 4),
      log('2026-03-07', 5),
      log('2026-03-08', 6),
      log('2026-03-09', 9),
    ];
    const report = buildPopSummary(logs, periods, '2026-03-03');
    expect(report.rows.map((row) => row.workedHours)).toEqual([3, 15]);
    expect(report.rows.map((row) => row.status)).toEqual(['Active', 'Upcoming']);
    expect(report.totals).toMatchObject({
      workedHours: 18,
      targetHours: 31.5,
      remainingHours: 13.5,
      fundedPercent: 78.75,
    });
  });

  it('includes full cross-year funding and work when either year is selected', () => {
    const periods = [period('2034-12-30', '2035-01-02', 14.5)];
    const logs = [log('2034-12-30', 8), log('2035-01-02', 7)];
    for (const year of [2034, 2035]) {
      expect(buildPopSummary(logs, periods, '2035-01-02', year).rows[0]).toMatchObject({
        targetHours: 14.5,
        workedHours: 15,
        remainingHours: -0.5,
      });
    }
    expect(buildPopSummary(logs, periods, '2035-01-02', 2036).rows).toEqual([]);
  });

  it('weights funded percentages and preserves negative availability and empty lists', () => {
    const report = buildPopSummary(
      [log('2026-03-02', 10)],
      [period('2026-03-02', '2026-03-03', 8), period('2026-03-04', '2026-03-04', 8)],
      '2026-03-31',
    );
    expect(report.rows.map((row) => row.fundedPercent)).toEqual([50, 100]);
    expect(report.totals.fundedPercent).toBeCloseTo(66.6667, 4);
    expect(report.rows[0].remainingHours).toBe(-2);
    expect(buildPopSummary([], [], '2026-03-31')).toEqual({
      rows: [],
      totals: {
        weekdays: 0,
        weekdayHours: 0,
        targetHours: 0,
        workedHours: 0,
        remainingHours: 0,
        fundedPercent: null,
      },
    });
    expect(
      buildPopSummary([], [period('2026-03-07', '2026-03-08', 1.75)], '2026-03-31').rows[0]
        .fundedPercent,
    ).toBeNull();
  });

  it('handles leap days, daylight-saving changes, and invalid ranges', () => {
    expect(
      buildPopSummary([], [period('2024-02-28', '2024-03-01', 3.75)], '2024-03-31').rows[0]
        .weekdays,
    ).toBe(3);
    expect(
      buildPopSummary([], [period('2026-03-07', '2026-03-09', 2.25)], '2026-03-31').rows[0]
        .weekdays,
    ).toBe(1);
    expect(() =>
      buildPopSummary([], [period('2035-02-10', '2035-02-01', 0)], '2035-02-11'),
    ).toThrow('Invalid range');
  });

  it('sums complete July–June POPs and reuses the active table row for cards', () => {
    const periods = [
      period('2035-06-01', '2035-06-30', 11.5),
      period('2035-07-01', '2035-10-27', 61.25),
      period('2035-10-28', '2036-06-30', 73.75),
      period('2036-07-01', '2036-08-12', 12.75),
    ];
    const logs = [
      log('2035-06-30', 20),
      log('2035-07-01', 9),
      log('2035-10-23', 7),
      log('2035-10-28', 6),
      log('2036-06-30', 3),
      log('2036-07-01', 20),
    ];
    const rows = buildPopSummary(logs, periods, '2035-10-23').rows;
    const cards = currentPopCards(rows, '2035-10-23');
    expect(cards.current).toMatchObject({ funded: 61.25, worked: 16, available: 45.3 });
    expect(cards.year).toEqual({
      startDate: '2035-07-01',
      endDate: '2036-06-30',
      funded: 135,
      worked: 25,
      available: 110,
    });
    expect(buildCurrentPopCards(logs, periods, '2035-10-23')).toEqual(cards);
    expect(buildCurrentPopCards([], periods, '2036-06-30').year.startDate).toBe('2035-07-01');
    expect(buildCurrentPopCards([], periods, '2035-07-01').year.startDate).toBe('2035-07-01');
    expect(buildCurrentPopCards([], [], '2035-10-23').current).toBeNull();
  });
});
