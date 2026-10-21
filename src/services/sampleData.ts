import { TimeLog } from '../types';
import { getMonthDays, getMonthSummary } from '../utils/calendar';

export const SAMPLE_YEAR = 2026;
export const SAMPLE_END = '2026-10-20';
export const SAMPLE_MONTH_NOTES = [
  'Scattered days off; MLK Day worked; just below 94%.',
  'No entries for the entire month.',
  'Scattered days off; exactly at the rounded 94% target.',
  'One day off; just above 94%.',
  'Memorial Day off; scattered days off; exactly at 94%.',
  'Juneteenth worked; scattered days off; just below 94%.',
  'July 13–17 off; observed Independence Day and one Saturday worked; just above 94%.',
  'No entries for the entire month.',
  'Labor Day off; scattered days off; exactly at 94%.',
  'Partial month through October 20; Columbus Day worked.',
  'Outside the sample range; no entries.',
  'Outside the sample range; no entries.',
];

/** Deterministic fixtures; integer tenths make monthly boundary cases reproducible. */
export function createSampleTimeLogs2026(): TimeLog[] {
  const daysOff = new Set([
    '2026-01-09', '2026-01-23', '2026-03-06', '2026-03-23', '2026-04-17',
    '2026-05-08', '2026-05-22', '2026-06-05', '2026-06-24',
    '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
    '2026-09-11', '2026-09-24', '2026-10-09',
  ]);
  const holidaysWorked = new Set(['2026-01-19', '2026-06-19', '2026-07-03', '2026-10-12']);
  const weekendWorked = '2026-07-11';
  const pattern = [60, 100, 74, 82, 96, 68, 89, 77, 93, 85];
  const logs: TimeLog[] = [];
  for (let month = 0; month < 10; month++) {
    if (month === 1 || month === 7) continue;
    const dates = getMonthDays(SAMPLE_YEAR, month).filter((day) =>
      day.date <= SAMPLE_END && !daysOff.has(day.date) &&
      ((!day.isWeekend && (!day.holiday || holidaysWorked.has(day.date))) || day.date === weekendWorked)
    );
    const target = getMonthSummary([], SAMPLE_YEAR, month).targetHours;
    // October uses the workdays elapsed through Oct 20, leaving the full-month target unmet.
    const partialTarget = Math.round(getMonthDays(SAMPLE_YEAR, month)
      .filter((day) => day.date <= SAMPLE_END && !day.isWeekend && !day.holiday).length * 8 * 0.94 * 10);
    const offsets = [-1, 0, 0, 1, 0, -1, 2, 0, 0, 0];
    const desiredTenths = month === 9 ? partialTarget : Math.round(target * 10) + offsets[month];
    const tenths = dates.map((_, index) => pattern[(index + month) % pattern.length]);
    // Keep a 6.0-hour and a 10.0-hour day in each populated month.
    tenths[0] = 60;
    tenths[1] = 100;
    let difference = desiredTenths - tenths.reduce((sum, value) => sum + value, 0);
    while (difference !== 0) {
      let changed = false;
      for (let i = 2; i < tenths.length && difference !== 0; i++) {
        const direction = Math.sign(difference);
        if (tenths[i] + direction >= 60 && tenths[i] + direction <= 100) {
          tenths[i] += direction;
          difference -= direction;
          changed = true;
        }
      }
      if (!changed) throw new Error(`Sample target is not achievable for month ${month + 1}`);
    }
    dates.forEach((day, index) => {
      const reason = day.holiday ? `Holiday worked: ${day.holiday}` : day.isWeekend ? 'Weekend catch-up shift' : 'Regular workday';
      logs.push({
        id: `sample-2026-${day.date}`, date: day.date, totalHours: tenths[index] / 10,
        notes: `Sample data · ${reason}`,
        createdAt: `${day.date}T18:00:00.000Z`, updatedAt: `${day.date}T18:00:00.000Z`,
      });
    });
  }
  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

export function sampleDataCsv(logs = createSampleTimeLogs2026()): string {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return ['date,totalHours,notes', ...[...logs].sort((a, b) => a.date.localeCompare(b.date))
    .map((log) => `${log.date},${log.totalHours.toFixed(1)},${quote(log.notes ?? '')}`)].join('\r\n');
}
