import React, { useEffect, useRef, useState } from 'react';
import { LeaveSettings } from '../types';

export const LeavePolicyForm: React.FC<{ settings: LeaveSettings; onSave: (settings: LeaveSettings) => Promise<void>; scope: string; disabled: boolean }> = ({ settings, onSave, scope, disabled }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { formRef.current?.reset(); }, [settings]);
  return <section className="calculator-card leave-policy" aria-labelledby="leave-policy-heading">
    <h3 id="leave-policy-heading" className="card-title">Leave & forecasts</h3>
    <p className="settings-description">Changes are saved to {scope}.</p>
    <form ref={formRef} onSubmit={async event => {
      event.preventDefault();
      if (busy || disabled) return;
      const data = new FormData(event.currentTarget);
      setBusy(true); setError(''); setSaved(false);
      try {
      await onSave({ openingMonth: String(data.get('openingMonth')), openingPto: Number(data.get('openingPto')),
        openingHoliday: Number(data.get('openingHoliday')), openingBirthday: Number(data.get('openingBirthday')),
        workPercent: Number(data.get('workPercent')) });
      setSaved(true);
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not save settings.'); } finally { setBusy(false); }
    }} onChange={() => setSaved(false)}><fieldset className="async-fields" disabled={busy || disabled}>
      <h4 className="settings-subheading">Opening balances</h4>
      <div className="report-settings-grid">
        <label>Opening balances at start of<input className="form-input" type="month" name="openingMonth" defaultValue={settings.openingMonth} required min="1900-01" max="2100-12" /></label>
        <label>Opening PTO (hours)<input className="form-input" type="number" name="openingPto" step="0.01" defaultValue={settings.openingPto} required /></label>
        <label>Opening holiday (hours)<input className="form-input" type="number" name="openingHoliday" step="0.01" defaultValue={settings.openingHoliday} required /></label>
        <label>Opening birthday (hours)<input className="form-input" type="number" name="openingBirthday" step="0.01" defaultValue={settings.openingBirthday} required /></label>
      </div>
      <h4 className="settings-subheading">Forecast assumptions</h4>
      <div className="report-settings-grid">
        <label>Future work rate (%)<input className="form-input" type="number" name="workPercent" step="0.1" min="0" max="200" defaultValue={settings.workPercent} required /></label>
      </div>
      <p className="settings-description">Birthday leave is credited in January. Monthly balances are calculated from opening balances, accruals, leave used, and adjustments.</p>
      <p className="settings-description">Forecasts use the future work rate on remaining non-holiday weekdays. PTO accrues at 0.0851 per hour worked; holiday credits are added each month and 8 birthday hours in January. The work rate affects future forecasts. Historical leave comes only from entered records.</p>
      <div className="sample-actions"><button type="submit" className="btn-primary">{busy ? 'Saving…' : 'Save leave settings'}</button><span role="status">{saved ? `Leave and forecast settings saved to ${scope}.` : ''}</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </fieldset></form>
  </section>;
};
