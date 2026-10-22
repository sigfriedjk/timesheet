import { LeaveCategory, LeaveEntry } from '../types';
import { roundToHundredth } from './calculations';

export const LEAVE_FIELDS: { category: LeaveCategory; label: string }[] = [
  { category: 'pto', label: 'PTO entered' },
  { category: 'holiday', label: 'Holiday entered' },
  { category: 'birthday', label: 'Birthday entered' },
  { category: 'overhead', label: 'Overhead entered' },
  { category: 'adjustment', label: 'PTO adjustment' },
];

export function enteredMonthTotal(entries: LeaveEntry[], month: string, category: LeaveCategory): number | null {
  const matching = entries.filter(entry => entry.date.startsWith(`${month}-`) && entry.category === category);
  return matching.length ? roundToHundredth(matching.reduce((sum, entry) => sum + entry.hours, 0)) : null;
}

/** Change one saved monthly total, retaining existing dates, IDs and notes where possible. */
export function setEnteredMonthTotal(entries: LeaveEntry[], month: string, category: LeaveCategory, hours: number | null, date: string, id: string): LeaveEntry[] {
  const matches = (entry: LeaveEntry) => entry.date.startsWith(`${month}-`) && entry.category === category;
  if (hours == null) return entries.filter(entry => !matches(entry));
  const target = roundToHundredth(hours);
  const current = enteredMonthTotal(entries, month, category);
  if (current === target) return entries;
  let delta = roundToHundredth(target - (current ?? 0));
  // Adjust signed PTO credits with a dated delta. For leave usage, reductions
  // consume the latest entries first so earlier actuals retain their dates.
  if (category === 'adjustment' || delta >= 0) return [...entries, { id, date, category, hours: delta }];
  const replacements = new Map<string, number>();
  for (const entry of entries.filter(matches).sort((a, b) => b.date.localeCompare(a.date))) {
    const reduction = Math.min(entry.hours, -delta);
    replacements.set(entry.id, roundToHundredth(entry.hours - reduction));
    delta = roundToHundredth(delta + reduction);
    if (delta === 0) break;
  }
  // Keep explicit zero entries: zero PTO/holiday intentionally overrides inference.
  return entries.map(entry => replacements.has(entry.id) ? { ...entry, hours: replacements.get(entry.id)! } : entry);
}
