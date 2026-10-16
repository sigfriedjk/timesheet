import { TimeLog } from '../types';
import { roundToTenth } from '../utils/calculations';

const STORAGE_KEYS = {
  TIME_LOGS: 'work_hours_tracker_time_logs',
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
export function getAllTimeLogs(): TimeLog[] {
  const data = getItem(STORAGE_KEYS.TIME_LOGS);
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
export function getTimeLogByDate(date: string): TimeLog | undefined {
  const logs = getAllTimeLogs();
  return logs.find((log) => log.date === date);
}

/**
 * Saves a TimeLog. If an entry exists for the given date, it overwrites totalHours and notes.
 * Enforces ROUND_0.1 on totalHours.
 */
export function saveTimeLog(
  date: string,
  totalHours: number,
  notes?: string
): { log: TimeLog; isOverwrite: boolean } {
  const logs = getAllTimeLogs();
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

  setItem(STORAGE_KEYS.TIME_LOGS, JSON.stringify(logs));
  return { log: updatedLog, isOverwrite };
}

/**
 * Deletes a TimeLog entry by date
 */
export function deleteTimeLog(date: string): boolean {
  const logs = getAllTimeLogs();
  const filtered = logs.filter((log) => log.date !== date);
  if (filtered.length !== logs.length) {
    setItem(STORAGE_KEYS.TIME_LOGS, JSON.stringify(filtered));
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
