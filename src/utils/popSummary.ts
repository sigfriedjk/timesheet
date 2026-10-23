import { PeriodOfPerformance, TimeLog } from '../types';
import { roundToTenth } from './calculations';

export function buildPopSummary(logs: TimeLog[], periods: readonly PeriodOfPerformance[], asOf: string, year?: number) {
  const rows = periods.filter(period => year == null || (period.startDate <= `${year}-12-31` && period.endDate >= `${year}-01-01`))
    .map(period => {
      const first = new Date(`${period.startDate}T00:00:00Z`);
      const last = new Date(`${period.endDate}T00:00:00Z`);
      if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || first > last) throw new Error(`Invalid range for ${period.name}`);
      let weekdays = 0;
      for (const date = new Date(first); date <= last; date.setUTCDate(date.getUTCDate() + 1)) {
        if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) weekdays++;
      }
      const weekdayHours = weekdays * 8;
      const workedHours = roundToTenth(logs.filter(log => log.date >= period.startDate && log.date <= period.endDate)
        .reduce((total, log) => total + log.totalHours, 0));
      const actualHours = roundToTenth(logs.filter(log => log.date >= period.startDate && log.date <= period.endDate && log.date <= asOf).reduce((sum, log) => sum + log.totalHours, 0));
      return { ...period, weekdays, weekdayHours, workedHours, actualHours, forecastHours: roundToTenth(workedHours - actualHours),
        fundedPercent: weekdayHours ? period.targetHours / weekdayHours * 100 : null,
        remainingHours: roundToTenth(period.targetHours - workedHours),
        status: period.startDate > asOf ? 'Upcoming' : period.endDate < asOf ? 'Completed' : 'Active' };
    });
  const total = (field: 'weekdays' | 'weekdayHours' | 'targetHours' | 'workedHours' | 'remainingHours') =>
    roundToTenth(rows.reduce((sum, row) => sum + row[field], 0));
  const totals = { weekdays: total('weekdays'), weekdayHours: total('weekdayHours'), targetHours: total('targetHours'), workedHours: total('workedHours'), remainingHours: total('remainingHours') };
  return { rows, totals: { ...totals, fundedPercent: totals.weekdayHours ? totals.targetHours / totals.weekdayHours * 100 : null } };
}
