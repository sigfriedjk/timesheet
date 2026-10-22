import { describe, expect, it } from 'vitest';
import { LeaveEntry } from '../types';
import { enteredMonthTotal, setEnteredMonthTotal } from './monthlyEntries';

const entries: LeaveEntry[] = [
  { id: 'early', date: '2026-10-02', category: 'pto', hours: 8.1, notes: 'Keep this date' },
  { id: 'late', date: '2026-10-28', category: 'pto', hours: 2.11, notes: 'Planned' },
  { id: 'other-month', date: '2026-09-01', category: 'pto', hours: 8 },
  { id: 'holiday', date: '2026-10-12', category: 'holiday', hours: 8 },
];
const setTotal = (category: LeaveEntry['category'], hours: number | null, source = entries) =>
  setEnteredMonthTotal(source, '2026-10', category, hours, '2026-10-22', 'new');

describe('saved monthly leave totals', () => {
  it('sums saved entries at hundredth precision and distinguishes absent data from explicit zero', () => {
    expect(enteredMonthTotal(entries, '2026-10', 'pto')).toBe(10.21);
    expect(enteredMonthTotal(entries, '2026-10', 'birthday')).toBeNull();
    expect(enteredMonthTotal(setTotal('birthday', 0), '2026-10', 'birthday')).toBe(0);
  });
  it('leaves unchanged records intact and adds only the increase on the chosen date', () => {
    expect(setTotal('pto', 10.21)).toBe(entries);
    const next = setTotal('pto', 12.21);
    expect(next.slice(0, 4)).toEqual(entries);
    expect(next[4]).toEqual({ id: 'new', date: '2026-10-22', category: 'pto', hours: 2 });
  });
  it('reduces later entries first, preserving IDs, notes and explicit zeros', () => {
    const next = setTotal('pto', 8);
    expect(next[0]).toEqual({ ...entries[0], hours: 8 });
    expect(next[1]).toEqual({ ...entries[1], hours: 0 });
    expect(next.slice(2)).toEqual(entries.slice(2));
    expect(enteredMonthTotal(setTotal('pto', 0), '2026-10', 'pto')).toBe(0);
    expect(entries[0].hours).toBe(8.1);
  });
  it('clears only the selected month and category when blank', () => {
    expect(setTotal('pto', null)).toEqual(entries.slice(2));
  });
  it('supports positive, negative and zero PTO adjustments without losing existing notes', () => {
    const original: LeaveEntry[] = [{ id: 'credit', date: '2026-10-01', category: 'adjustment', hours: 2, notes: 'Correction' }];
    const negative = setTotal('adjustment', -1.25, original);
    expect(negative[0]).toEqual(original[0]);
    expect(enteredMonthTotal(negative, '2026-10', 'adjustment')).toBe(-1.25);
    expect(enteredMonthTotal(setTotal('adjustment', 0, negative), '2026-10', 'adjustment')).toBe(0);
  });
});
