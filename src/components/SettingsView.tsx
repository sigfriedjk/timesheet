import React, { useState } from 'react';
import { LeaveSettings } from '../types';
import { LeavePolicyForm } from './LeavePolicyForm';
import { MONTH_NAMES } from '../utils/calendar';
import { SAMPLE_MONTH_NOTES } from '../services/sampleData';
import { PopSettings } from './PopSettings';
import { SupabaseSettings, SupabaseProjectSettings } from './SupabaseSettings';
import { SupabaseConnection } from '../hooks/useSupabaseConnection';
import { Workspace } from '../hooks/useWorkspace';
import { DataTransferSettings } from './DataTransferSettings';

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

export const SettingsView: React.FC<SettingsViewProps> = ({ isSample, leaveSettings, onSaveLeaveSettings, onUseSample, onUsePersonal, onResetSample, connection, workspace }) => {
  const [status, setStatus] = useState('');
  const [resetError, setResetError] = useState('');
  const [sampleRevision, setSampleRevision] = useState(0);
  const scope = isSample ? 'this browser’s sample workspace' : 'My data';
  const project = connection.config ? new URL(connection.config.url).host : 'No project configured';
  const sourceStatus = workspace.error ? 'Could not load your timesheet.'
    : !isSample && connection.error ? 'Could not verify your sign-in.'
    : !isSample && !connection.config ? 'Configure a project in Advanced project setup.'
    : !isSample && !connection.authReady ? 'Checking your sign-in…'
    : !isSample && !connection.session ? 'Sign in to load My data.'
    : !workspace.ready ? 'Loading your timesheet…'
    : workspace.busy ? 'Saving changes…' : 'Ready';
  return (
    <div className="settings-view">
      <div className="view-header"><h2>Settings</h2></div>
      <section className="calculator-card data-source-settings" aria-labelledby="data-source-title">
        <h3 id="data-source-title" className="card-title">Data source</h3>
        <fieldset className="dataset-selector" disabled={workspace.busy}>
          <legend className="sr-only">Choose personal or sample data</legend>
          <label className="dataset-option"><input type="radio" name="dataset" value="personal" checked={!isSample} onChange={onUsePersonal} /><span><strong>My data · Supabase</strong><small>Personal timesheet saved to your signed-in account.</small></span></label>
          <label className="dataset-option"><input type="radio" name="dataset" value="sample2026" checked={isSample} onChange={onUseSample} /><span><strong>2026 sample data · This browser</strong><small>Separate, editable example data.</small></span></label>
        </fieldset>
        <p className="settings-description">{isSample ? 'Using 2026 sample data. Settings and edits apply only to this browser’s sample workspace. Your personal timesheet is separate.' : 'Using My data. Settings and edits apply to your signed-in Supabase account.'} Switching sources does not copy data between them.</p>
        <dl className="source-context">
          {!isSample && <><div><dt>Account</dt><dd>{connection.session?.user.email ?? 'Not signed in'}</dd></div><div><dt>Project</dt><dd>{project}</dd></div></>}
          <div><dt>Status</dt><dd role="status">{sourceStatus}</dd></div>
        </dl>
        {workspace.error && <><p className="form-error" role="alert">{workspace.error}</p><button type="button" className="btn-secondary" onClick={workspace.reload}>Retry loading data</button></>}
        {!isSample && connection.error && <p className="form-error" role="alert">{connection.error}</p>}
        {!isSample && <SupabaseSettings connection={connection} workspace={workspace} />}
      </section>

      {isSample && <section className="calculator-card sample-settings" aria-labelledby="sample-controls-title">
        <h3 id="sample-controls-title" className="card-title">Sample controls</h3>
        <p className="settings-description">Reset restores the original time entries, leave and forecast settings, and POP definitions in this sample workspace.</p>
        <div className="sample-actions">
          <button type="button" className="btn-secondary" disabled={!workspace.ready || workspace.busy} onClick={() => {
            setResetError(''); setStatus('');
            try {
              const count = onResetSample();
              setSampleRevision(value => value + 1);
              setStatus(`Sample data reset to the original ${count} entries.`);
            } catch (error) { setResetError(error instanceof Error ? error.message : 'Could not reset sample data.'); }
          }}>Reset sample data</button>
          <a className="btn-secondary" href="?sample=2026">Open sample calendar</a>
        </div>
        <p className="settings-status" role="status">{status}</p>
        {resetError && <p className="form-error" role="alert">{resetError}</p>}
        <details className="sample-coverage settings-disclosure">
          <summary>About the 2026 sample</summary>
          <p>149 entries from January 1–October 20. February and August are empty; July includes a full week off. Holidays are both worked and taken off, with one Saturday shift. Each logged day has 6.0–10.0 hours.</p>
          <p>Monthly baseline = 8 hours × weekdays, excluding observed US federal holidays. Full populated months sit near 94%; October is partial. Unlogged dates indicate no entry, not recorded leave.</p>
          <ul className="sample-month-notes">{SAMPLE_MONTH_NOTES.slice(0, 10).map((note, i) => <li key={i}><strong>{MONTH_NAMES[i]}:</strong> {note}</li>)}</ul>
        </details>
      </section>}

      {workspace.ready ? <>
        <LeavePolicyForm key={`leave-${sampleRevision}`} settings={leaveSettings} onSave={onSaveLeaveSettings} scope={scope} disabled={workspace.busy} />
        <PopSettings key={`pop-${sampleRevision}`} workspace={workspace} scope={scope} />
        {!isSample && <DataTransferSettings workspace={workspace} account={connection.session?.user.email ?? ''} project={project} />}
      </> : <section className="calculator-card settings-unavailable" aria-labelledby="workspace-settings-title">
        <h3 id="workspace-settings-title" className="card-title">Workspace settings</h3>
        <p className="settings-description">{isSample ? 'Leave, forecast, and POP settings will be available when sample data loads.' : connection.session ? 'Leave, forecast, POP, and backup controls will be available when your account data loads.' : 'Sign in and load My data to edit leave, forecasts, and POP definitions, or back up and restore your timesheet.'}</p>
      </section>}
      {!isSample && <SupabaseProjectSettings connection={connection} disabled={workspace.busy} />}
    </div>
  );
};
