import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllTimeLogs,
  getTimeLogByDate,
  saveTimeLog,
  deleteTimeLog,
  clearStorageForTesting,
} from './storage';

describe('Storage Service (Local-First Persistence & Overwrite Logic)', () => {
  beforeEach(() => {
    clearStorageForTesting();
  });

  it('saves a new time log with rounded hours to 0.1', () => {
    const result = saveTimeLog('2026-10-16', 8.04, 'Normal shift');
    expect(result.isOverwrite).toBe(false);
    expect(result.log.totalHours).toBe(8.0);
    expect(result.log.date).toBe('2026-10-16');
    expect(result.log.notes).toBe('Normal shift');

    const retrieved = getTimeLogByDate('2026-10-16');
    expect(retrieved).toBeDefined();
    expect(retrieved?.totalHours).toBe(8.0);
  });

  it('overwrites previous time log on the same date with updated hours', () => {
    // Initial save (e.g., midday check-in: 4.2 hours)
    const initial = saveTimeLog('2026-10-16', 4.2, 'Midday sync');
    expect(initial.isOverwrite).toBe(false);
    expect(initial.log.totalHours).toBe(4.2);

    // Later in the day: user works more hours (9.6 hours)
    const updated = saveTimeLog('2026-10-16', 9.58, 'Full shift complete');
    expect(updated.isOverwrite).toBe(true);
    expect(updated.log.totalHours).toBe(9.6);
    expect(updated.log.notes).toBe('Full shift complete');

    // Only one entry should exist for this date
    const all = getAllTimeLogs();
    const matching = all.filter((l) => l.date === '2026-10-16');
    expect(matching.length).toBe(1);
    expect(matching[0].totalHours).toBe(9.6);
  });

  it('deletes a log entry by date', () => {
    saveTimeLog('2026-10-15', 8.0);
    expect(getTimeLogByDate('2026-10-15')).toBeDefined();

    const deleted = deleteTimeLog('2026-10-15');
    expect(deleted).toBe(true);
    expect(getTimeLogByDate('2026-10-15')).toBeUndefined();
  });
});
