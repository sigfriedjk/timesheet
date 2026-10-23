import { useState } from 'react';
import { TimeLog } from '../../types';
import { emptyWeekdays } from '../../utils/monthAutofill';

interface Props {
  logs: TimeLog[];
  initialMonth: string;
  disabled: boolean;
  onFillMonth: (month: string) => Promise<number>;
  onFilled: (month: string) => void;
}

export function MonthAutofill({ logs, initialMonth, disabled, onFillMonth, onFilled }: Props) {
  const [fillMonth, setFillMonth] = useState(initialMonth);
  const [filling, setFilling] = useState(false);
  const [fillStatus, setFillStatus] = useState('');
  const [fillError, setFillError] = useState('');
  let fillCount = 0;
  try {
    fillCount = emptyWeekdays(fillMonth, logs).length;
  } catch {
    /* Native month validation also blocks submission. */
  }
  return (
    <details className="calculator-card calendar-autofill settings-disclosure">
      <summary>Autofill a month with 8-hour weekdays</summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (filling || disabled) return;
          setFilling(true);
          setFillStatus('');
          setFillError('');
          try {
            const count = await onFillMonth(fillMonth);
            onFilled(fillMonth);
            setFillStatus(
              `Added ${count} eight-hour entries for ${fillMonth}. Existing entries were kept.`,
            );
          } catch (error) {
            setFillError(error instanceof Error ? error.message : 'Could not autofill this month.');
          } finally {
            setFilling(false);
          }
        }}
      >
        <fieldset className="async-fields" disabled={filling || disabled}>
          <label className="form-label">
            Month to autofill
            <input
              className="form-input"
              type="month"
              min="1900-01"
              max="2100-12"
              required
              value={fillMonth}
              onChange={(event) => {
                setFillMonth(event.target.value);
                setFillStatus('');
                setFillError('');
              }}
            />
          </label>
          <p className="settings-description">
            Adds 8 hours to empty Monday–Friday dates, including holidays. Existing hours, zero
            entries, and notes stay as entered. Future entries become your forecast; past entries
            count as recorded work.
          </p>
          <button type="submit" className="btn-secondary" disabled={!fillCount}>
            {filling ? 'Saving…' : `Add ${fillCount} weekday entries`}
          </button>
        </fieldset>
        <p className="settings-status" role="status">
          {fillStatus}
        </p>
        {fillError && (
          <p className="form-error" role="alert">
            {fillError}
          </p>
        )}
      </form>
    </details>
  );
}
