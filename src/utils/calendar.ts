import { TimeLog } from '../types';
import { roundToTenth } from './calculations';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function calendarDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/** Includes actual and observed dates, including New Year's observed in the prior year. */
export function getFederalHolidays(year: number): Record<string, string> {
  const holidays: Record<string, string> = {};
  const add = (date: Date, name: string) => {
    if (date.getUTCFullYear() === year) holidays[date.toISOString().slice(0, 10)] = name;
  };
  const nth = (month: number, weekday: number, occurrence: number) =>
    new Date(Date.UTC(year, month, 1 + (weekday - new Date(Date.UTC(year, month, 1)).getUTCDay() + 7) % 7 + 7 * (occurrence - 1)));
  for (const y of [year - 1, year, year + 1]) {
    for (const [month, day, name] of [
      [0, 1, "New Year's Day"], [5, 19, 'Juneteenth'], [6, 4, 'Independence Day'],
      [10, 11, 'Veterans Day'], [11, 25, 'Christmas Day'],
    ] as const) {
      const date = new Date(Date.UTC(y, month, day));
      add(date, name);
      if (date.getUTCDay() === 6 || date.getUTCDay() === 0) {
        const observed = new Date(date);
        observed.setUTCDate(day + (date.getUTCDay() === 6 ? -1 : 1));
        add(observed, `${name} (observed)`);
      }
    }
  }
  add(nth(0, 1, 3), 'Martin Luther King Jr. Day');
  add(nth(1, 1, 3), "Presidents' Day");
  const memorial = new Date(Date.UTC(year, 5, 0));
  memorial.setUTCDate(memorial.getUTCDate() - (memorial.getUTCDay() + 6) % 7);
  add(memorial, 'Memorial Day');
  add(nth(8, 1, 1), 'Labor Day');
  add(nth(9, 1, 2), 'Columbus Day');
  add(nth(10, 4, 4), 'Thanksgiving Day');
  return holidays;
}

export function getMonthDays(year: number, month: number) {
  const holidays = getFederalHolidays(year);
  return Array.from({ length: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() }, (_, i) => {
    const day = i + 1;
    const date = calendarDate(year, month, day);
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
    return { date, day, weekday, isWeekend: weekday === 0 || weekday === 6, holiday: holidays[date] };
  });
}

export function getMonthCells(year: number, month: number) {
  const days = getMonthDays(year, month);
  return Array.from({ length: 42 }, (_, i) => days[i - days[0].weekday] ?? null);
}

export function getMonthSummary(logs: TimeLog[], year: number, month: number) {
  const days = getMonthDays(year, month);
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const entries = logs.filter((log) => log.date.startsWith(prefix));
  const hours = roundToTenth(entries.reduce((sum, log) => sum + log.totalHours, 0));
  const expectedHours = days.filter((day) => !day.isWeekend && !day.holiday).length * 8;
  const targetHours = roundToTenth(expectedHours * 0.94);
  return {
    month, name: MONTH_NAMES[month], days: entries.filter((log) => log.totalHours > 0).length,
    hours, expectedHours, targetHours, variance: roundToTenth(hours - targetHours),
    percent: expectedHours ? roundToTenth(hours / expectedHours * 100) : 0,
  };
}
