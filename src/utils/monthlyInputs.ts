import { LeaveCategory, LeaveEntry, TimeLog } from '../types';
import { roundToHundredth, roundToTenth } from './calculations';

type LeaveUsage = Record<LeaveCategory, number>;
const emptyUsage = (): LeaveUsage => ({
  pto: 0,
  holiday: 0,
  birthday: 0,
  overhead: 0,
  adjustment: 0,
});

/** Group once, retaining input order so precision and dated-entry behavior stay stable. */
export function groupByMonth<T extends { date: string }>(records: T[]): Map<string, T[]> {
  const months = new Map<string, T[]>();
  for (const record of records) {
    // Match the report's YYYY-MM- prefix even when loading older, unvalidated local data.
    if (record.date[7] !== '-') continue;
    const key = record.date.slice(0, 7);
    const month = months.get(key);
    if (month) month.push(record);
    else months.set(key, [record]);
  }
  return months;
}

export function monthlyWork(logs: TimeLog[], asOf: string) {
  let actual = 0;
  let planned = 0;
  for (const log of logs) {
    if (log.date <= asOf) actual += log.totalHours;
    else planned += log.totalHours;
  }
  // Recorded work is rounded before future entries are added, matching report precision.
  const actualHours = roundToTenth(actual);
  const workHours = roundToTenth(actualHours + planned);
  return { actualHours, workHours, remainingHours: roundToTenth(workHours - actualHours) };
}

export function monthlyLeave(entries: LeaveEntry[], asOf: string) {
  const actual = emptyUsage();
  const planned = emptyUsage();
  for (const entry of entries) {
    const usage = entry.date <= asOf ? actual : planned;
    if (Object.prototype.hasOwnProperty.call(usage, entry.category))
      usage[entry.category] += entry.hours;
  }

  const used = emptyUsage();
  for (const category of Object.keys(actual) as LeaveCategory[]) {
    actual[category] = roundToHundredth(actual[category]);
    planned[category] = roundToHundredth(planned[category]);
    used[category] = roundToHundredth(actual[category] + planned[category]);
  }
  return { actual, used };
}
