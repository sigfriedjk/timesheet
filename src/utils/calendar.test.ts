import { describe, expect, it } from 'vitest';
import { getFederalHolidays, getMonthCells, getMonthDays, getMonthSummary } from './calendar';
import { createSampleTimeLogs2026, sampleDataCsv } from '../services/sampleData';

describe('Year calendar', () => {
  it('places every date exactly once with correct weekday alignment and six complete weeks', () => {
    for (const year of [2024, 2026, 2027]) {
      const dates: string[] = [];
      for (let month = 0; month < 12; month++) {
        const cells = getMonthCells(year, month);
        expect(cells).toHaveLength(42);
        const days = cells.filter((day) => day !== null);
        expect(days).toHaveLength(new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
        cells.forEach((day, index) => { if (day) expect(day.weekday).toBe(index % 7); });
        dates.push(...days.map((day) => day.date));
      }
      expect(dates).toHaveLength(year === 2024 ? 366 : 365);
      expect(new Set(dates).size).toBe(dates.length);
    }
    expect(getMonthDays(2026, 0)[0].weekday).toBe(4);
    expect(getMonthDays(2026, 1)).toHaveLength(28);
  });

  it('computes moving holidays, weekend observations, and cross-year observations', () => {
    const holidays = getFederalHolidays(2026);
    expect(holidays['2026-01-19']).toContain('Martin Luther');
    expect(holidays['2026-05-25']).toBe('Memorial Day');
    expect(holidays['2026-07-03']).toBe('Independence Day (observed)');
    expect(holidays['2026-07-04']).toBe('Independence Day');
    expect(holidays['2026-11-26']).toBe('Thanksgiving Day');
    expect(getFederalHolidays(2027)['2027-01-18']).toContain('Martin Luther');
    expect(getFederalHolidays(2027)['2027-12-31']).toBe("New Year's Day (observed)");
    expect(getFederalHolidays(2026)['2026-12-31']).toBeUndefined();
  });

  it('uses eight-hour weekdays excluding observed holidays, and includes worked holidays in totals', () => {
    const logs = createSampleTimeLogs2026();
    expect(getMonthSummary(logs, 2026, 0)).toMatchObject({ hours: 150.3, expectedHours: 160, targetHours: 150.4, variance: -0.1 });
    expect(getMonthSummary(logs, 2026, 6)).toMatchObject({ hours: 165.6, expectedHours: 176, targetHours: 165.4, variance: 0.2 });
    expect(getMonthSummary([], 2026, 1)).toMatchObject({ days: 0, hours: 0, percent: 0, expectedHours: 152, targetHours: 142.9 });
  });
});

describe('2026 sample coverage', () => {
  const logs = createSampleTimeLogs2026();
  it('is reproducible, unique by date, bounded by the requested range, and varies from 6.0 to 10.0 hours', () => {
    expect(createSampleTimeLogs2026()).toEqual(logs);
    expect(logs).toHaveLength(149);
    expect(new Set(logs.map((log) => log.date)).size).toBe(149);
    for (const log of logs) {
      expect(log.date >= '2026-01-01' && log.date <= '2026-10-20').toBe(true);
      expect(log.totalHours).toBeGreaterThanOrEqual(6);
      expect(log.totalHours).toBeLessThanOrEqual(10);
      expect(log.totalHours * 10).toBeCloseTo(Math.round(log.totalHours * 10));
    }
    expect(Math.min(...logs.map((log) => log.totalHours))).toBe(6);
    expect(Math.max(...logs.map((log) => log.totalHours))).toBe(10);
  });

  it('covers empty months, scattered days off, a whole week off, holidays worked/off, and a weekend shift', () => {
    const dates = new Set(logs.map((log) => log.date));
    expect(logs.filter((log) => log.date.startsWith('2026-02') || log.date.startsWith('2026-08'))).toEqual([]);
    for (const date of ['2026-01-01', '2026-01-09', '2026-05-25', '2026-09-07', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']) expect(dates.has(date)).toBe(false);
    for (const date of ['2026-01-19', '2026-06-19', '2026-07-03', '2026-07-11', '2026-10-12', '2026-10-20']) expect(dates.has(date)).toBe(true);
  });

  it('exercises below, exact, and above 94% monthly boundaries while keeping October partial', () => {
    const summaries = Array.from({ length: 10 }, (_, month) => getMonthSummary(logs, 2026, month));
    expect(summaries.map((month) => month.hours)).toEqual([150.3, 0, 165.4, 165.5, 150.4, 157.8, 165.6, 0, 157.9, 97.8]);
    expect(summaries[0].variance).toBe(-0.1);
    expect(summaries[2].variance).toBe(0);
    expect(summaries[3].variance).toBe(0.1);
    expect(summaries[9].hours).toBeLessThan(summaries[9].targetHours);
    expect(getMonthSummary(logs, 2026, 10).hours).toBe(0);
    expect(getMonthSummary(logs, 2026, 11).hours).toBe(0);
  });

  it('exports every sample entry to CSV with tenths and quoted notes', () => {
    const rows = sampleDataCsv(logs).split('\r\n');
    expect(rows).toHaveLength(150);
    expect(rows[0]).toBe('date,totalHours,notes');
    expect(rows[1]).toContain('2026-01-02,6.0,');
    expect(rows.at(-1)).toContain('2026-10-20');
  });
});
