import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { MonthlyRow } from '../../utils/monthlySummary';
import { LeaveCategory, MonthlyReportState } from '../../types';
import { MONTH_NAMES, calendarDate } from '../../utils/calendar';
import { generateId } from '../../services/storage';
import { LEAVE_FIELDS, enteredMonthTotal, setEnteredMonthTotal } from '../../utils/monthlyEntries';
import { formatNumber as fixed } from '../../utils/format';

export const MonthEditor: React.FC<{
  row: MonthlyRow;
  asOf: string;
  state: MonthlyReportState;
  onChange: (state: MonthlyReportState) => Promise<void>;
  onClose: () => void;
  onSaving: (saving: boolean) => void;
}> = ({ row, asOf, state, onChange, onClose, onSaving }) => {
  const firstInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        LEAVE_FIELDS.map(({ category }) => {
          const total = enteredMonthTotal(state.entries, row.key, category);
          return [category, total == null ? '' : fixed(total)];
        }),
      ) as Record<LeaveCategory, string>,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    firstInput.current?.focus();
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    onSaving(true);
    setError('');
    try {
      const last = calendarDate(row.year, row.month + 1, 0);
      const date = row.key === asOf.slice(0, 7) ? asOf : last < asOf ? last : `${row.key}-01`;
      let entries = state.entries;
      for (const { category } of LEAVE_FIELDS) {
        const hours = values[category] === '' ? null : Number(values[category]);
        if (hours != null && (!Number.isFinite(hours) || (category !== 'adjustment' && hours < 0)))
          throw new Error('Enter valid hours. Only PTO adjustment can be negative.');
        entries = setEnteredMonthTotal(entries, row.key, category, hours, date, generateId());
      }
      await onChange({ ...state, entries });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save changes.');
    } finally {
      setBusy(false);
      onSaving(false);
    }
  };
  return (
    <form
      id="month-editor"
      className="month-totals-editor"
      aria-labelledby="month-editor-heading"
      aria-describedby="month-editor-help"
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <fieldset className="async-fields" disabled={busy}>
        <div className="table-header-row">
          <h3 id="month-editor-heading">
            {MONTH_NAMES[row.month]} {row.year}
          </h3>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close month editor"
          >
            <X size={18} />
          </button>
        </div>
        <div className="month-totals-fields">
          {LEAVE_FIELDS.map(({ category, label }, index) => (
            <label key={category}>
              {label}
              <input
                ref={index === 0 ? firstInput : undefined}
                className="form-input"
                type="number"
                min={category === 'adjustment' ? undefined : 0}
                step="0.01"
                placeholder="0"
                value={values[category]}
                onChange={(event) => setValues({ ...values, [category]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <p id="month-editor-help" className="settings-description">
          Hours entered for this month. Blank clears the entered value; enter 0 to explicitly record
          zero. Past leave uses only entered values. Future work and leave use entered records only.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="sample-actions">
          <button type="submit" className="btn-primary">
            {busy ? 'Saving…' : 'Save month'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
};
