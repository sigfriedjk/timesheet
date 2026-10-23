import { LeaveCategory, MonthlyReportState, PeriodOfPerformance, TimeLog } from '../types';
import { createDefaultMonthlyReport } from './monthlyReport';
import { roundToTenth } from '../utils/calculations';
import { generateId, LogDataset } from './storage';

export interface TimesheetImport {
  logs: TimeLog[];
  report: MonthlyReportState | null;
  dataset?: LogDataset;
  periods?: PeriodOfPerformance[];
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (field: string): never => {
  throw new Error(`Invalid ${field} in JSON file.`);
};
function number(value: unknown, field: string, minimum = -Infinity, maximum = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
    return fail(field);
  return value;
}
function date(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ||
    value.startsWith('0000')
  )
    return fail(field);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    return fail(field);
  return value;
}
function month(value: unknown, field: string): string {
  if (typeof value !== 'string') return fail(field);
  date(`${value}-01`, field);
  return value;
}
function notes(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') return fail('notes');
  return value;
}
function report(value: unknown): MonthlyReportState | null {
  if (value == null) return null;
  if (!object(value) || !object(value.settings) || !Array.isArray(value.entries))
    return fail('leave settings');
  const defaults = createDefaultMonthlyReport().settings;
  const settings = value.settings;
  const setting = (key: keyof typeof defaults) =>
    settings[key] === undefined ? defaults[key] : settings[key];
  if (
    value.ptoPolicyVersion !== undefined &&
    value.ptoPolicyVersion !== 0 &&
    value.ptoPolicyVersion !== 1
  )
    return fail('PTO policy version');
  const categories: LeaveCategory[] = ['pto', 'holiday', 'birthday', 'overhead', 'adjustment'];
  const entryIds = new Set<string>();
  const entries = value.entries.map((entry) => {
    if (!object(entry) || !categories.includes(entry.category as LeaveCategory))
      return fail('leave entry');
    const id = typeof entry.id === 'string' && entry.id ? entry.id : generateId();
    if (entryIds.has(id)) return fail('duplicate leave entry ID');
    entryIds.add(id);
    return {
      id,
      date: date(entry.date, 'leave date'),
      category: entry.category as LeaveCategory,
      hours: number(entry.hours, 'leave hours', entry.category === 'adjustment' ? -Infinity : 0),
      notes: notes(entry.notes),
    };
  });
  const projections = value.projectedWork === undefined ? {} : value.projectedWork;
  if (!object(projections)) return fail('work projections');
  return {
    ptoPolicyVersion: 1,
    settings: {
      openingMonth: month(setting('openingMonth'), 'opening month'),
      openingPto: number(setting('openingPto'), 'opening PTO'),
      openingHoliday: number(setting('openingHoliday'), 'opening holiday balance'),
      openingBirthday: number(setting('openingBirthday'), 'opening birthday balance'),
      workPercent: number(setting('workPercent'), 'work percentage', 0, 200),
    },
    entries,
    projectedWork: Object.fromEntries(
      Object.entries(projections).map(([key, hours]) => [
        month(key, 'projection month'),
        number(hours, 'projected hours', 0),
      ]),
    ),
  };
}

export function validatePeriods(value: unknown): PeriodOfPerformance[] {
  if (!Array.isArray(value)) return fail('POP list');
  const ids = new Set<string>();
  return value.map((item) => {
    if (
      !object(item) ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.name !== 'string' ||
      !item.name.trim()
    )
      return fail('POP name or ID');
    if (ids.has(item.id)) return fail('duplicate POP ID');
    ids.add(item.id);
    const startDate = date(item.startDate, 'POP start date'),
      endDate = date(item.endDate, 'POP end date');
    if (endDate < startDate) return fail('POP date range');
    return {
      id: item.id,
      name: item.name.trim(),
      startDate,
      endDate,
      targetHours: number(item.targetHours, 'POP funded hours', 0),
    };
  });
}

/** Validate the entire file before any storage writes; accept older log-array downloads too. */
export function parseTimesheetJson(contents: string): TimesheetImport {
  let value: unknown;
  try {
    value = JSON.parse(contents.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('Choose a valid JSON file.');
  }
  const backup = Array.isArray(value) ? { logs: value } : value;
  if (!object(backup) || !Array.isArray(backup.logs))
    throw new Error('Expected a timesheet JSON backup or an array of time entries.');
  if (backup.format !== undefined && backup.format !== 'timesheet') return fail('backup format');
  if (backup.version !== undefined && backup.version !== 1 && backup.version !== 2)
    throw new Error('This JSON backup version is not supported.');
  if (
    backup.dataset !== undefined &&
    backup.dataset !== 'personal' &&
    backup.dataset !== 'sample2026'
  )
    return fail('data source');
  const dates = new Set<string>();
  const now = new Date().toISOString();
  const logs = backup.logs.map((row, index) => {
    if (!object(row)) return fail(`entry ${index + 1}`);
    const logDate = date(row.date, `date in entry ${index + 1}`);
    if (dates.has(logDate))
      throw new Error(
        `The JSON file contains more than one entry for ${logDate}. Keep one entry per date.`,
      );
    dates.add(logDate);
    return {
      id: typeof row.id === 'string' && row.id ? row.id : generateId(),
      date: logDate,
      totalHours: roundToTenth(
        number(
          row.totalHours === undefined ? row.total_hours : row.totalHours,
          `hours in entry ${index + 1}`,
          0,
          24,
        ),
      ),
      notes: notes(row.notes),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : now,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : now,
    };
  });
  if (backup.version === 2 && (!object(backup.report) || backup.periods === undefined))
    throw new Error('This complete backup is missing leave settings or POP data.');
  return {
    logs,
    report: report(backup.report),
    periods: backup.periods === undefined ? undefined : validatePeriods(backup.periods),
    dataset: backup.dataset as LogDataset | undefined,
  };
}

/** Export timesheet data only, with no Auth session, account IDs, or connection credentials. */
export function exportTimesheetJson(
  logs: TimeLog[],
  state: MonthlyReportState | null,
  dataset: LogDataset,
  periods?: PeriodOfPerformance[],
): string {
  return JSON.stringify(
    {
      format: 'timesheet',
      version: periods !== undefined && state !== null ? 2 : 1,
      exportedAt: new Date().toISOString(),
      dataset,
      logs: logs.map((log) => ({
        id: log.id,
        date: log.date,
        totalHours: log.totalHours,
        notes: log.notes,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      })),
      report: report(state),
      ...(periods !== undefined ? { periods: validatePeriods(periods) } : {}),
    },
    null,
    2,
  );
}
