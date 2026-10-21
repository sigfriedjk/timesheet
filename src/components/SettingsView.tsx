import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { MONTH_NAMES } from '../utils/calendar';
import { SAMPLE_MONTH_NOTES, createSampleTimeLogs2026, sampleDataCsv } from '../services/sampleData';

interface SettingsViewProps {
  isSample: boolean;
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

export const SettingsView: React.FC<SettingsViewProps> = ({ isSample, onUseSample, onUsePersonal, onResetSample }) => {
  const [status, setStatus] = useState('');
  return (
    <div className="settings-view">
      <div className="view-header"><h2>Settings</h2></div>
      <section className="calculator-card sample-settings" aria-labelledby="sample-settings-title">
        <h3 id="sample-settings-title" className="card-title">Data source</h3>
        <fieldset className="dataset-selector">
          <legend className="sr-only">Choose personal or sample data</legend>
          <label className="dataset-option"><input type="radio" name="dataset" value="personal" checked={!isSample} onChange={() => { setStatus(''); onUsePersonal(); }} /><span>My data</span></label>
          <label className="dataset-option"><input type="radio" name="dataset" value="sample2026" checked={isSample} onChange={() => { setStatus(''); onUseSample(); }} /><span>2026 sample data</span></label>
        </fieldset>
        <p className="settings-description">{isSample ? 'You are using sample data. Your personal logs are kept separate.' : 'You are using your personal logs. Switch to sample data to try the calendar with test entries.'}</p>
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
