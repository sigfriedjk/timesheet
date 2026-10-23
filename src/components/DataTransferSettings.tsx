import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Workspace } from '../hooks/useWorkspace';
import { exportTimesheetJson, parseTimesheetJson, TimesheetImport } from '../services/jsonBackup';

function downloadJson(name: string, contents: string) {
  const href = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = href; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const DataTransferSettings: React.FC<{ workspace: Workspace; account: string; project: string }> = ({ workspace, account, project }) => {
  const [file, setFile] = useState<{ name: string; contents: string; backup: TimesheetImport } | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const selection = useRef(0);
  const dataset = 'personal';
  useEffect(() => () => { selection.current++; }, []);
  const disabled = reading || busy || workspace.busy || !workspace.ready;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setStatus(''); setError('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'The request could not be completed.'); }
    finally { setBusy(false); }
  };
  return <section className="calculator-card data-transfer-settings" aria-labelledby="data-transfer-title">
    <h3 id="data-transfer-title" className="card-title">Backup & restore</h3>
    <p className="settings-description">Back up all saved inputs: time entries and notes, POP names/dates/funding, monthly PTO/Holiday/Birthday/Overhead/PTO adjustments, opening balances, and leave settings. Monthly balances are recalculated; birthday credit is always in January.</p>
    <div className="sample-actions">
      <button type="button" className="btn-secondary" disabled={disabled} onClick={() => void run(async () => {
        downloadJson(`timesheet-${dataset}-${new Date().toISOString().slice(0, 10)}.json`, exportTimesheetJson(workspace.logs, workspace.report, dataset, workspace.periods));
        setStatus(`Exported ${workspace.logs.length} time entries, ${workspace.report.entries.length} leave/adjustment entries, ${workspace.periods.length} POPs, and all saved settings.`);
      })}><Download size={16} />Export backup</button>
    </div>
    <details className="settings-disclosure restore-settings"><summary>Restore from JSON…</summary>
    <p className="settings-description">Destination: <strong>{account}</strong> · {project}</p>
    <label className="form-label" htmlFor="timesheet-json-file">JSON file</label>
    <input id="timesheet-json-file" className="form-input" type="file" accept=".json,application/json" disabled={busy || workspace.busy || !workspace.ready} onChange={async event => {
      const token = ++selection.current;
      const selected = event.target.files?.[0];
      setFile(null); setStatus(''); setError(''); setConfirmed(false);
      if (!selected) { setReading(false); return; }
      setReading(true);
      try {
        if (selected.size > 10 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 10 MB.');
        const contents = await selected.text();
        const backup = parseTimesheetJson(contents);
        if (backup.dataset && backup.dataset !== dataset) throw new Error('Choose a My data backup. Sample backups cannot be restored to your personal account.');
        if (selection.current === token) setFile({ name: selected.name, contents, backup });
      } catch (error) { if (selection.current === token) setError(error instanceof Error ? error.message : 'Could not read the JSON file.'); }
      finally { if (selection.current === token) setReading(false); }
    }} />
    {reading && <p role="status">Reading JSON file…</p>}
    {file && <p className="json-import-preview">{file.name}: {file.backup.logs.length} time entries; {file.backup.report?.entries.length ?? 0} leave/adjustment entries; {file.backup.periods?.length ?? 'default'} POPs.</p>}
    <p className="settings-description">Import replaces every time entry, leave/adjustment entry, POP definition, opening balance, and saved report setting in your signed-in account only. Existing data absent from the file is removed. Export a backup first if you want to keep it.</p>
    {file && (!file.backup.report || file.backup.periods === undefined) && <p role="note">This older file is incomplete. Missing leave/settings reset to defaults; missing POP definitions reset to the original POP list.</p>}
    <label className="restore-confirmation"><input type="checkbox" checked={confirmed} disabled={disabled || !file} onChange={event => setConfirmed(event.target.checked)} /><span>Replace all data in My data with this file.</span></label>
    <div className="sample-actions"><button type="button" className="btn-primary" disabled={disabled || !file || !confirmed} onClick={() => void run(async () => {
      if (!file || !confirmed) return;
      const count = await workspace.importJson(file.contents);
      setStatus(`Replaced this workspace with ${count} time entries and the file's leave, POP, and settings data.`);
      setConfirmed(false);
    })}><Upload size={16} />{busy ? 'Working…' : 'Restore backup'}</button></div>
    </details>
    <p className="settings-status" role="status">{status}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
};
