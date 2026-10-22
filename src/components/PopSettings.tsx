import React, { useState } from 'react';
import { PeriodOfPerformance } from '../types';
import { Workspace } from '../hooks/useWorkspace';
import { generateId } from '../services/storage';

export const PopSettings: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [draft, setDraft] = useState<PeriodOfPerformance | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const periods = workspace.periods;
  const disabled = !workspace.ready || workspace.busy;
  const save = async (next: PeriodOfPerformance[], message: string) => {
    setError(''); setStatus('');
    try { await workspace.savePeriods(next); setDraft(null); setStatus(message); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save POP changes.'); }
  };
  return <section className="calculator-card pop-settings" aria-labelledby="pop-settings-title">
    <h3 id="pop-settings-title" className="card-title">Periods of performance</h3>
    <p className="settings-description">Names, inclusive dates, and funded hours are saved with the selected workspace and included in JSON backups.</p>
    {!workspace.ready && <p>Sign in and load My data to edit your POP definitions, or switch to sample data.</p>}
    <div className="monthly-table-scroll pop-settings-scroll" tabIndex={0} aria-label="POP ranges and funded hours">
      <table className="monthly-table pop-settings-table">
        <thead><tr><th scope="col" className="month-column">POP</th><th scope="col">Start date</th><th scope="col">End date</th><th scope="col">Funded hours</th><th scope="col">Actions</th></tr></thead>
        <tbody>{periods.map(period => <tr key={period.id} data-period={period.id}><th scope="row" className="month-column">{period.name}</th><td><time dateTime={period.startDate}>{period.startDate}</time></td><td><time dateTime={period.endDate}>{period.endDate}</time></td><td>{period.targetHours.toFixed(1)}</td><td><button type="button" className="btn-secondary" disabled={disabled} onClick={() => { setDraft({ ...period }); setError(''); setStatus(''); }} aria-label={`Edit ${period.name}`}>Edit</button></td></tr>)}</tbody>
      </table>
    </div>
    <div className="sample-actions"><button type="button" className="btn-secondary" disabled={disabled} onClick={() => { setDraft({ id: generateId(), name: '', startDate: '', endDate: '', targetHours: 0 }); setError(''); setStatus(''); }}>Add POP</button></div>
    {draft && <form className="pop-editor" aria-label="Edit POP" onSubmit={event => {
      event.preventDefault();
      const next = periods.some(period => period.id === draft.id) ? periods.map(period => period.id === draft.id ? draft : period) : [...periods, draft];
      void save([...next].sort((a, b) => a.startDate.localeCompare(b.startDate)), 'POP definitions saved.');
    }}><fieldset className="async-fields" disabled={disabled}>
      <div className="report-settings-grid">
        <label>POP name<input className="form-input" value={draft.name} required onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Start date<input className="form-input" type="date" value={draft.startDate} required onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
        <label>End date<input className="form-input" type="date" value={draft.endDate} min={draft.startDate || undefined} required onChange={event => setDraft({ ...draft, endDate: event.target.value })} /></label>
        <label>Funded hours<input className="form-input" type="number" min="0" step="0.1" value={Number.isNaN(draft.targetHours) ? '' : draft.targetHours} required onChange={event => setDraft({ ...draft, targetHours: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
      </div>
      <div className="sample-actions"><button type="submit" className="btn-primary">{workspace.busy ? 'Saving…' : 'Save POP'}</button><button type="button" className="btn-secondary" onClick={() => setDraft(null)}>Cancel</button>
        {periods.some(period => period.id === draft.id) && <button type="button" className="btn-secondary" onClick={() => { if (window.confirm(`Delete ${draft.name} from this workspace?`)) void save(periods.filter(period => period.id !== draft.id), 'POP deleted.'); }}>Delete POP</button>}
      </div>
    </fieldset></form>}
    <p className="settings-status" role="status">{status}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
};
