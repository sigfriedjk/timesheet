import { expect, it } from 'vitest';
import { emptyWeekdays } from './monthAutofill';
import { TimeLog } from '../types';

it('fills only empty weekdays, including holidays, while preserving zero entries and notes', () => {
  const logs = [{ date: '2026-01-02', totalHours: 0, notes: 'Keep leave day' }, { date: '2026-01-05', totalHours: 9.3 }] as TimeLog[];
  const before = JSON.stringify(logs);
  const dates = emptyWeekdays('2026-01', logs);
  expect(dates).toHaveLength(20);
  expect(dates).toContain('2026-01-01');
  expect(dates).not.toContain('2026-01-02');
  expect(dates).not.toContain('2026-01-03');
  expect(dates).not.toContain('2026-01-05');
  expect(JSON.stringify(logs)).toBe(before);
  expect(emptyWeekdays('2024-02', [])).toContain('2024-02-29');
  for (const month of ['', '2026-13', '2026-00', '1899-12']) expect(() => emptyWeekdays(month, [])).toThrow('Choose a month');
});
