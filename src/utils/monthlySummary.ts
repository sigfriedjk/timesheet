import { LeaveEntry, LeaveSettings, MonthlyReportState, TimeLog } from '../types';
import { calendarDate, getMonthDays } from './calendar';
import { roundToHundredth as cents, roundToTenth as tenths } from './calculations';

export const PTO_RATE = 0.0851;
export const DAY_HOURS = 8;
export interface LeaveBalance { pto: number; holiday: number; birthday: number; total: number }
export interface MonthlyRow {
  key: string; year: number; month: number; projected: boolean;
  weekdays: number; holidayCount: number; weekdayHours: number; actualHours: number; workHours: number;
  remainingHours: number; leaveNeeded: number; rollingTotal: number; rollingAverage: number; rollingMonths: number;
  accruedPto: number; accruedHoliday: number; accruedBirthday: number;
  usedPto: number; usedHoliday: number; usedBirthday: number; overhead: number; adjustment: number;
  balance: LeaveBalance | null; actualBalance: LeaveBalance | null;
}

export function createDefaultMonthlyReport(year = new Date().getFullYear()): MonthlyReportState {
  return { ptoPolicyVersion: 1, settings: { openingMonth: `${year}-01`, openingPto: 0, openingHoliday: 0, openingBirthday: 0,
    workPercent: 94.3, autoPto: true }, entries: [], projectedWork: {} };
}

export function normalizeLeaveSettings(settings: Partial<LeaveSettings> | undefined, defaults: LeaveSettings): LeaveSettings {
  return {
    openingMonth: settings?.openingMonth ?? defaults.openingMonth,
    openingPto: settings?.openingPto ?? defaults.openingPto,
    openingHoliday: settings?.openingHoliday ?? defaults.openingHoliday,
    openingBirthday: settings?.openingBirthday ?? defaults.openingBirthday,
    workPercent: settings?.workPercent ?? defaults.workPercent,
    autoPto: settings?.autoPto ?? defaults.autoPto,
  };
}

function monthIndex(key: string) {
  const [year, month] = key.split('-').map(Number);
  return year * 12 + month - 1;
}
function monthKey(index: number) { return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`; }
function balance(pto: number, holiday: number, birthday: number): LeaveBalance {
  const values = { pto: cents(pto), holiday: cents(holiday), birthday: cents(birthday) };
  return { ...values, total: cents(values.pto + values.holiday + values.birthday) };
}
function total(entries: LeaveEntry[], category: LeaveEntry['category']) {
  return cents(entries.filter(entry => entry.category === category).reduce((sum, entry) => sum + entry.hours, 0));
}
function has(entries: LeaveEntry[], category: LeaveEntry['category']) { return entries.some(entry => entry.category === category); }

/** Actual leave uses dated entries. Forecasts fill remaining weekday gaps; neither writes daily logs. */
export function buildMonthlySummary(logs: TimeLog[], state: MonthlyReportState, selectedYear: number, asOf: string) {
  const { settings, entries, projectedWork } = state;
  const cutoffMonth = monthIndex(asOf.slice(0, 7));
  const opening = monthIndex(settings.openingMonth);
  const selectedStart = selectedYear * 12;
  const selectedEnd = selectedStart + 11;
  const earliestLog = logs.length ? Math.min(...logs.map(log => monthIndex(log.date.slice(0, 7)))) : opening;
  const historyStart = Math.min(opening, earliestLog);
  const start = Math.min(opening, selectedStart - 11, historyStart);
  const end = Math.max(selectedEnd, cutoffMonth);
  const logMap = new Map(logs.map(log => [log.date, log]));
  const rows = new Map<number, MonthlyRow>();
  let actualBalance = balance(settings.openingPto, settings.openingHoliday, settings.openingBirthday);
  let projectedBalance = { ...actualBalance };

  for (let index = start; index <= end; index++) {
    const year = Math.floor(index / 12), month = index % 12, key = monthKey(index);
    const days = getMonthDays(year, month);
    const first = calendarDate(year, month, 1), last = calendarDate(year, month + 1, 0);
    const completed = last <= asOf;
    const monthLogs = logs.filter(log => log.date.startsWith(`${key}-`));
    const actualHours = tenths(monthLogs.filter(log => log.date <= asOf).reduce((sum, log) => sum + log.totalHours, 0));
    const monthEntries = entries.filter(entry => entry.date.startsWith(`${key}-`));
    const actualEntries = monthEntries.filter(entry => entry.date <= asOf);
    const futureEntries = monthEntries.filter(entry => entry.date > asOf);
    const weekdays = days.filter(day => !day.isWeekend);
    const holidays = weekdays.filter(day => day.holiday);
    const actualWeekdayHours = weekdays.filter(day => day.date <= asOf).length * DAY_HOURS;
    const futureWeekdayHours = weekdays.filter(day => day.date > asOf).length * DAY_HOURS;
    const actualHolidayUsed = has(actualEntries, 'holiday') ? total(actualEntries, 'holiday')
      : holidays.filter(day => day.date <= asOf && !(logMap.get(day.date)?.totalHours)).length * DAY_HOURS;
    const futureHolidayUsed = has(futureEntries, 'holiday') ? total(futureEntries, 'holiday')
      : holidays.filter(day => day.date > asOf && !(logMap.get(day.date)?.totalHours)).length * DAY_HOURS;
    const actualBirthdayUsed = total(actualEntries, 'birthday'), futureBirthdayUsed = total(futureEntries, 'birthday');
    const actualOverhead = total(actualEntries, 'overhead'), futureOverhead = total(futureEntries, 'overhead');
    const actualPtoUsed = has(actualEntries, 'pto') ? total(actualEntries, 'pto')
      : settings.autoPto ? cents(Math.max(0, actualWeekdayHours - actualHours - actualHolidayUsed - actualBirthdayUsed - actualOverhead)) : 0;

    let futureWork = 0;
    for (const day of days.filter(day => day.date > asOf)) {
      const scheduled = logMap.get(day.date);
      if (scheduled) { futureWork += scheduled.totalHours; continue; }
      if (day.isWeekend || day.holiday) continue;
      const timeOff = futureEntries.filter(entry => entry.date === day.date && entry.category !== 'adjustment')
        .reduce((sum, entry) => sum + entry.hours, 0);
      futureWork += Math.max(0, DAY_HOURS * settings.workPercent / 100 - timeOff);
    }
    if (!completed && Object.prototype.hasOwnProperty.call(projectedWork, key)) {
      futureWork = Math.max(0, projectedWork[key] - actualHours);
    }
    const workHours = tenths(actualHours + futureWork);
    const remainingHours = tenths(workHours - actualHours);
    const futurePtoUsed = completed ? 0 : cents(Math.max(total(futureEntries, 'pto'), futureWeekdayHours - remainingHours - futureHolidayUsed - futureBirthdayUsed - futureOverhead, 0));
    const actualPtoAccrued = cents(actualHours * PTO_RATE);
    const accruedPto = cents(workHours * PTO_RATE);
    const accruedHoliday = holidays.length * DAY_HOURS;
    const accruedBirthday = month === 0 ? DAY_HOURS : 0;
    const actualAdjustment = total(actualEntries, 'adjustment');
    const adjustment = cents(actualAdjustment + total(futureEntries, 'adjustment'));
    const usedPto = cents(actualPtoUsed + futurePtoUsed);
    const usedHoliday = cents(actualHolidayUsed + futureHolidayUsed);
    const usedBirthday = cents(actualBirthdayUsed + futureBirthdayUsed);
    const overhead = cents(actualOverhead + futureOverhead);
    let closing: LeaveBalance | null = null, actualClosing: LeaveBalance | null = null;
    if (index >= opening) {
      projectedBalance = balance(projectedBalance.pto + accruedPto - usedPto + adjustment,
        projectedBalance.holiday + accruedHoliday - usedHoliday, projectedBalance.birthday + accruedBirthday - usedBirthday);
      closing = { ...projectedBalance };
      if (first <= asOf) {
        actualBalance = balance(actualBalance.pto + actualPtoAccrued - actualPtoUsed + actualAdjustment,
          actualBalance.holiday + accruedHoliday - actualHolidayUsed, actualBalance.birthday + accruedBirthday - actualBirthdayUsed);
        actualClosing = { ...actualBalance };
      }
    }
    rows.set(index, {
      key, year, month, projected: !completed, weekdays: weekdays.length, holidayCount: holidays.length,
      weekdayHours: weekdays.length * DAY_HOURS, actualHours, workHours, remainingHours,
      leaveNeeded: tenths(Math.max(0, weekdays.length * DAY_HOURS - workHours)),
      accruedPto, accruedHoliday, accruedBirthday, usedPto, usedHoliday, usedBirthday, overhead, adjustment,
      rollingTotal: 0, rollingAverage: 0, rollingMonths: 0, balance: closing, actualBalance: actualClosing,
    });
  }
  for (const [index, row] of rows) {
    const window = Array.from({ length: 12 }, (_, offset) => index - 11 + offset).filter(i => i >= historyStart);
    row.rollingMonths = window.length;
    row.rollingTotal = tenths(window.reduce((sum, i) => sum + (rows.get(i)?.workHours ?? 0), 0));
    row.rollingAverage = window.length ? tenths(row.rollingTotal / window.length) : 0;
  }
  const selectedRows = Array.from({ length: 12 }, (_, month) => rows.get(selectedStart + month)!);
  const sum = (field: keyof Pick<MonthlyRow, 'weekdayHours' | 'holidayCount' | 'actualHours' | 'workHours' | 'leaveNeeded' | 'accruedPto' | 'accruedHoliday' | 'accruedBirthday' | 'usedPto' | 'usedHoliday' | 'usedBirthday' | 'overhead' | 'adjustment'>) =>
    cents(selectedRows.reduce((value, row) => value + row[field], 0));
  const actualCutoffIndex = Math.min(selectedEnd, cutoffMonth);
  const completedIndex = Math.min(selectedEnd, cutoffMonth - 1);
  const completedWindow = Array.from({ length: 12 }, (_, offset) => completedIndex - 11 + offset).filter(i => i >= historyStart);
  const actualRollingTotal = tenths(completedWindow.reduce((sum, i) => sum + (rows.get(i)?.actualHours ?? 0), 0));
  return {
    rows: selectedRows,
    totals: { weekdayHours: sum('weekdayHours'), holidayCount: sum('holidayCount'), actualHours: sum('actualHours'),
      workHours: sum('workHours'), leaveNeeded: sum('leaveNeeded'), accruedPto: sum('accruedPto'),
      accruedHoliday: sum('accruedHoliday'), accruedBirthday: sum('accruedBirthday'), usedPto: sum('usedPto'),
      usedHoliday: sum('usedHoliday'), usedBirthday: sum('usedBirthday'), overhead: sum('overhead'), adjustment: sum('adjustment') },
    currentBalance: actualCutoffIndex >= opening ? rows.get(actualCutoffIndex)?.actualBalance ?? null : null,
    yearEndBalance: selectedRows[11].balance,
    rolling: { total: actualRollingTotal, average: completedWindow.length ? tenths(actualRollingTotal / completedWindow.length) : null,
      months: completedWindow.length, start: monthKey(completedIndex - 11), end: monthKey(completedIndex) },
  };
}
