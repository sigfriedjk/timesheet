import React, { useEffect, useRef, useState } from 'react';
import { LeaveSettings } from '../types';
import { parsePtoAccrualRate } from '../utils/ptoAccrualRate';

export const LeavePolicyForm: React.FC<{
  settings: LeaveSettings;
  onSave: (settings: LeaveSettings) => Promise<void>;
  scope: string;
  disabled: boolean;
}> = ({ settings, onSave, scope, disabled }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.reset();
  }, [settings]);
  return (
    <section className="calculator-card leave-policy" aria-labelledby="leave-policy-heading">
      <details className="settings-disclosure leave-settings">
        <summary>
          <h3 id="leave-policy-heading" className="card-title">
            Leave & forecasts
          </h3>
        </summary>
        <p className="settings-description">Changes are saved to {scope}.</p>
        <form
          ref={formRef}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || disabled) return;
            const data = new FormData(event.currentTarget);
            setBusy(true);
            setError('');
            setSaved(false);
            try {
              await onSave({
                ptoAccrualRate: parsePtoAccrualRate(String(data.get('ptoAccrualRate') ?? '')),
                openingMonth: String(data.get('openingMonth')),
                openingPto: Number(data.get('openingPto')),
                openingHoliday: Number(data.get('openingHoliday')),
                openingBirthday: Number(data.get('openingBirthday')),
                workPercent: settings.workPercent,
              });
              setSaved(true);
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Could not save settings.');
            } finally {
              setBusy(false);
            }
          }}
          onChange={() => setSaved(false)}
        >
          <fieldset className="async-fields" disabled={busy || disabled}>
            <h4 className="settings-subheading">PTO accrual rate</h4>
            <label className="form-label">
              PTO hours earned per hour worked
              <input
                className="form-input"
                type="number"
                name="ptoAccrualRate"
                required
                min="0"
                max="1"
                step="0.00000001"
                defaultValue={settings.ptoAccrualRate ?? ''}
                aria-describedby="pto-rate-help"
              />
            </label>
            <p id="pto-rate-help" className="settings-description">
              Enter hours of PTO per one hour worked, not a percentage. Use 0 through 1, with up to
              8 decimal places. Monthly accrual rounds to 0.01 hours after multiplying by worked
              hours. A blank rate is unconfigured; an entered 0 is valid. Changing this rate
              recalculates all monthly PTO accruals in this workspace.
            </p>
            <h4 className="settings-subheading">Opening balances</h4>
            <div className="report-settings-grid">
              <label>
                Opening balances at start of
                <input
                  className="form-input"
                  type="month"
                  name="openingMonth"
                  defaultValue={settings.openingMonth}
                  required
                  min="1900-01"
                  max="2100-12"
                />
              </label>
              <label>
                Opening PTO (hours)
                <input
                  className="form-input"
                  type="number"
                  name="openingPto"
                  step="0.01"
                  defaultValue={settings.openingPto}
                  required
                />
              </label>
              <label>
                Opening holiday (hours)
                <input
                  className="form-input"
                  type="number"
                  name="openingHoliday"
                  step="0.01"
                  defaultValue={settings.openingHoliday}
                  required
                />
              </label>
              <label>
                Opening birthday (hours)
                <input
                  className="form-input"
                  type="number"
                  name="openingBirthday"
                  step="0.01"
                  defaultValue={settings.openingBirthday}
                  required
                />
              </label>
            </div>
            <p className="settings-description">
              Birthday leave is credited in January. Monthly balances are calculated from opening
              balances, accruals, leave used, and adjustments.
            </p>
            <p className="settings-description">
              PTO accrues using your configured rate; holiday credits are added each month and 8
              birthday hours in January. Work and leave forecasts use entered records only. Missing
              dates contribute zero.
            </p>
            <div className="sample-actions">
              <button type="submit" className="btn-primary">
                {busy ? 'Saving…' : 'Save leave settings'}
              </button>
              <span role="status">{saved ? `Leave settings saved to ${scope}.` : ''}</span>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </fieldset>
        </form>
      </details>
    </section>
  );
};
