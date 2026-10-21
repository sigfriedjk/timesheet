import { TimeLog, MonthlyReportState } from '../types';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';
import { roundToTenth } from '../utils/calculations';
import { createSampleTimeLogs2026 } from './sampleData';

export type LogDataset = 'personal' | 'sample2026';

const STORAGE_KEYS = {
  TIME_LOGS: 'work_hours_tracker_time_logs',
  SAMPLE_LOGS: 'work_hours_tracker_sample_2026_logs',
  ACTIVE_DATASET: 'work_hours_tracker_active_dataset',
  POPS: 'work_hours_tracker_pops',
  LEAVE_ADJUSTMENTS: 'work_hours_tracker_leave_adjustments',
};

// In-memory fallback if localStorage is unavailable (e.g. during Node/test environment)
let memoryStore: Record<string, string> = {};

function getItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStore[key] || null;
  } catch {
    return memoryStore[key] || null;
  }
}

function setItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    memoryStore[key] = value;
  } catch {
    memoryStore[key] = value;
  }
}

/**
 * Generates a clean unique ID
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Retrieves all saved TimeLog entries, sorted by date descending.
 */
export function getAllTimeLogs(dataset: LogDataset = 'personal'): TimeLog[] {
  const data = getItem(dataset === 'sample2026' ? STORAGE_KEYS.SAMPLE_LOGS : STORAGE_KEYS.TIME_LOGS);
  if (!data) return [];
  try {
    const logs: TimeLog[] = JSON.parse(data);
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/**
 * Retrieves a TimeLog by date (YYYY-MM-DD)
 */
export function getTimeLogByDate(date: string, dataset: LogDataset = 'personal'): TimeLog | undefined {
  const logs = getAllTimeLogs(dataset);
  return logs.find((log) => log.date === date);
}

/**
 * Saves a TimeLog. If an entry exists for the given date, it overwrites totalHours and notes.
 * Enforces ROUND_0.1 on totalHours.
 */
export function saveTimeLog(
  date: string,
  totalHours: number,
  notes?: string,
  dataset: LogDataset = 'personal'
): { log: TimeLog; isOverwrite: boolean } {
  const logs = getAllTimeLogs(dataset);
  const existingIndex = logs.findIndex((item) => item.date === date);
  const now = new Date().toISOString();
  const roundedHours = roundToTenth(totalHours);

  let updatedLog: TimeLog;
  const isOverwrite = existingIndex >= 0;

  if (isOverwrite) {
    const existing = logs[existingIndex];
    updatedLog = {
      ...existing,
      totalHours: roundedHours,
      notes: notes ?? existing.notes,
      updatedAt: now,
    };
    logs[existingIndex] = updatedLog;
  } else {
    updatedLog = {
      id: generateId(),
      date,
      totalHours: roundedHours,
      notes: notes || undefined,
      createdAt: now,
      updatedAt: now,
    };
    logs.push(updatedLog);
  }

  setItem(dataset === 'sample2026' ? STORAGE_KEYS.SAMPLE_LOGS : STORAGE_KEYS.TIME_LOGS, JSON.stringify(logs));
  return { log: updatedLog, isOverwrite };
}

/**
 * Deletes a TimeLog entry by date
 */
export function deleteTimeLog(date: string, dataset: LogDataset = 'personal'): boolean {
  const logs = getAllTimeLogs(dataset);
  const filtered = logs.filter((log) => log.date !== date);
  if (filtered.length !== logs.length) {
    setItem(dataset === 'sample2026' ? STORAGE_KEYS.SAMPLE_LOGS : STORAGE_KEYS.TIME_LOGS, JSON.stringify(filtered));
    return true;
  }
  return false;
}

/**
 * Clears in-memory store (useful for tests)
 */
export function clearStorageForTesting(): void {
  memoryStore = {};
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  } catch {
    // Ignore
  }
}

export function getActiveLogDataset(): LogDataset {
  return getItem(STORAGE_KEYS.ACTIVE_DATASET) === 'sample2026' ? 'sample2026' : 'personal';
}

export function setActiveLogDataset(dataset: LogDataset): void {
  setItem(STORAGE_KEYS.ACTIVE_DATASET, dataset);
}

/** The sample has its own store; reset never changes personal entries. */
export function initializeSampleLogs(reset = false): TimeLog[] {
  if (reset) saveMonthlyReportState(createDefaultMonthlyReport(2026), 'sample2026');
  if (reset || getItem(STORAGE_KEYS.SAMPLE_LOGS) === null) {
    setItem(STORAGE_KEYS.SAMPLE_LOGS, JSON.stringify(createSampleTimeLogs2026()));
  }
  return getAllTimeLogs('sample2026');
}

export function getMonthlyReportState(dataset: LogDataset = 'personal'): MonthlyReportState {
  const fallback = createDefaultMonthlyReport(dataset === 'sample2026' ? 2026 : new Date().getFullYear());
  try {
    const stored = getItem(`work_hours_tracker_${dataset}_monthly_report`);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as MonthlyReportState;
    if (!parsed || !Array.isArray(parsed.entries)) return fallback;
    const state = { ...fallback, ...parsed, settings: { ...fallback.settings, ...parsed.settings }, entries: parsed.entries, projectedWork: parsed.projectedWork ?? {} };
    // Apply the requested policy once to existing stores, preserving later user opt-outs.
    if ((parsed.ptoPolicyVersion ?? 0) < 1) {
      state.ptoPolicyVersion = 1;
      state.settings.autoPto = true;
      saveMonthlyReportState(state, dataset);
    }
    return state;
  } catch { return fallback; }
}

export function saveMonthlyReportState(state: MonthlyReportState, dataset: LogDataset = 'personal'): void {
  setItem(`work_hours_tracker_${dataset}_monthly_report`, JSON.stringify({ ...state, ptoPolicyVersion: 1 }));
}
