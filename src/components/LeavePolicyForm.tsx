import React, { useEffect, useRef, useState } from 'react';
import { LeaveSettings } from '../types';
import { MONTH_NAMES } from '../utils/calendar';

export const LeavePolicyForm: React.FC<{ settings: LeaveSettings; onSave: (settings: LeaveSettings) => void }> = ({ settings, onSave }) => {
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { formRef.current?.reset(); }, [settings]);
  return <section className="calculator-card leave-policy" aria-labelledby="leave-policy-heading">
    <h3 id="leave-policy-heading" className="card-title">Leave & forecasts</h3>
    <form ref={formRef} onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSave({ openingMonth: String(data.get('openingMonth')), openingPto: Number(data.get('openingPto')),
        openingHoliday: Number(data.get('openingHoliday')), openingBirthday: Number(data.get('openingBirthday')),
        birthdayMonth: Number(data.get('birthdayMonth')), workPercent: Number(data.get('workPercent')), autoPto: data.has('autoPto') });
      setSaved(true);
    }}>
      <div className="report-settings-grid">
        <label>Opening balances at start of<input className="form-input" type="month" name="openingMonth" defaultValue={settings.openingMonth} required min="1900-01" max="2100-12" /></label>
        <label>Opening PTO (hours)<input className="form-input" type="number" name="openingPto" step="0.01" defaultValue={settings.openingPto} required /></label>
        <label>Opening holiday (hours)<input className="form-input" type="number" name="openingHoliday" step="0.01" defaultValue={settings.openingHoliday} required /></label>
        <label>Opening birthday (hours)<input className="form-input" type="number" name="openingBirthday" step="0.01" defaultValue={settings.openingBirthday} required /></label>
        <label>Future work rate (%)<input className="form-input" type="number" name="workPercent" step="0.1" min="0" max="200" defaultValue={settings.workPercent} required /></label>
        <label>Birthday credit month<select className="form-input" name="birthdayMonth" defaultValue={settings.birthdayMonth}>{MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
      </div>
      <label className="checkbox-label"><input type="checkbox" name="autoPto" defaultChecked={settings.autoPto} />Auto-fill historical PTO gaps</label>
      <p className="settings-description">When enabled, unlogged weekday hours become PTO after holiday, birthday, and overhead hours. Empty months also count as PTO. An explicit PTO entry overrides that month's automatic amount.</p>
      <p className="settings-description">Forecasts use the future work rate on remaining non-holiday weekdays. PTO accrues at 0.0851 per hour worked; holiday credits and 8 birthday hours are added at the start of their month. Opening balances and leave entries are saved with the selected data source.</p>
      <div className="sample-actions"><button type="submit" className="btn-primary">Save leave settings</button><span role="status">{saved ? 'Leave and forecast settings saved.' : ''}</span></div>
    </form>
  </section>;
};
