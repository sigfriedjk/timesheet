import { TimeLog } from '../types';
import { getMonthDays } from './calendar';

/** Explicitly fill empty Monday–Friday dates; saved zeroes and notes are protected. */
export function emptyWeekdays(month: string, logs: TimeLog[]): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1900 || Number(month.slice(0, 4)) > 2100) {
    throw new Error('Choose a month between January 1900 and December 2100.');
  }
  const dates = new Set(logs.map(log => log.date));
  return getMonthDays(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1)
    .filter(day => !day.isWeekend && !dates.has(day.date)).map(day => day.date);
}
