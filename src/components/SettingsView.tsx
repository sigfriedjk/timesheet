import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { LeaveSettings } from '../types';
import { LeavePolicyForm } from './LeavePolicyForm';
import { MONTH_NAMES } from '../utils/calendar';
import { SAMPLE_MONTH_NOTES, createSampleTimeLogs2026, sampleDataCsv } from '../services/sampleData';
import { POP_PERIODS } from '../config/periodsOfPerformance';
import { SupabaseSettings } from './SupabaseSettings';
import { SupabaseConnection } from '../hooks/useSupabaseConnection';
import { Workspace } from '../hooks/useWorkspace';

interface SettingsViewProps {
  isSample: boolean;
  leaveSettings: LeaveSettings;
  onSaveLeaveSettings: (settings: LeaveSettings) => Promise<void>;
  connection: SupabaseConnection;
  workspace: Workspace;
  onUseSample: () => void;
  onUsePersonal: () => void;
  onResetSample: () => number;
}

function downloadFile(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isSample, leaveSettings, onSaveLeaveSettings, onUseSample, onUsePersonal, onResetSample, connection, workspace }) => {
  const [status, setStatus] = useState('');
  return (
    <div className="settings-view">
      <div className="view-header"><h2>Settings</h2></div>
      <SupabaseSettings connection={connection} workspace={workspace} isSample={isSample} />
      <section className="calculator-card pop-settings" aria-labelledby="pop-settings-title">
        <h3 id="pop-settings-title" className="card-title">Periods of performance</h3>
        <p className="settings-description">These 24 POP ranges and funded hours are fixed for now and shared by both data sources. Start and end dates are inclusive.</p>
        <div className="monthly-table-scroll pop-settings-scroll" tabIndex={0} aria-label="Fixed POP ranges and funded hours">
          <table className="monthly-table pop-settings-table">
            <thead><tr><th scope="col" className="month-column">POP</th><th scope="col">Start date</th><th scope="col">End date</th><th scope="col">Funded hours</th></tr></thead>
            <tbody>{POP_PERIODS.map(period => <tr key={period.id} data-period={period.id}><th scope="row" className="month-column">{period.name}</th><td><time dateTime={period.startDate}>{period.startDate}</time></td><td><time dateTime={period.endDate}>{period.endDate}</time></td><td>{period.targetHours.toFixed(1)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      {workspace.ready && <LeavePolicyForm key={isSample ? 'sample' : connection.session?.user.id} settings={leaveSettings} onSave={onSaveLeaveSettings} />}
      <section className="calculator-card sample-settings" aria-labelledby="sample-settings-title">
        <h3 id="sample-settings-title" className="card-title">Data source</h3>
        <fieldset className="dataset-selector">
          <legend className="sr-only">Choose personal or sample data</legend>
          <label className="dataset-option"><input type="radio" name="dataset" value="personal" checked={!isSample} onChange={() => { setStatus(''); onUsePersonal(); }} /><span>My data · Supabase</span></label>
          <label className="dataset-option"><input type="radio" name="dataset" value="sample2026" checked={isSample} onChange={() => { setStatus(''); onUseSample(); }} /><span>2026 sample data</span></label>
        </fieldset>
        <p className="settings-description">{isSample ? 'You are using sample data in this browser. Your Supabase data is kept separate.' : 'Your personal timesheet uses Supabase. Switch to sample data to try the views with local test entries.'}</p>
        <div className="sample-actions">
          <button type="button" className="btn-secondary" disabled={!isSample} onClick={() => setStatus(`Sample data reset to the original ${onResetSample()} entries.`)}>Reset sample data</button>
          <a className="btn-secondary" href="?sample=2026">Open sample calendar</a>
        </div>
        <p className="settings-status" role="status">{status}</p>

        <details className="sample-coverage">
          <summary>2026 sample data coverage & downloads</summary>
          <p>149 entries from January 1–October 20. February and August are empty; July includes a full week off. Holidays are both worked and taken off, with one Saturday shift. Each logged day has 6.0–10.0 hours.</p>
          <p>Monthly baseline = 8 hours × weekdays, excluding observed US federal holidays. Full populated months sit near 94%; October is partial. Unlogged dates indicate no entry, not recorded leave.</p>
          <div className="sample-actions">
            <button type="button" className="btn-secondary" onClick={() => downloadFile('timesheet-sample-2026.csv', sampleDataCsv(), 'text/csv;charset=utf-8')}><Download size={16} />Download sample CSV</button>
            <button type="button" className="btn-secondary" onClick={() => downloadFile('timesheet-sample-2026.json', JSON.stringify(createSampleTimeLogs2026(), null, 2), 'application/json')}><Download size={16} />Download sample JSON</button>
          </div>
          <ul className="sample-month-notes">{SAMPLE_MONTH_NOTES.slice(0, 10).map((note, i) => <li key={i}><strong>{MONTH_NAMES[i]}:</strong> {note}</li>)}</ul>
        </details>
      </section>
    </div>
  );
};
