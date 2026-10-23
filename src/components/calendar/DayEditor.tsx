import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TimeLog } from '../../types';
import { formatNumber } from '../../utils/format';

export const DayEditor: React.FC<{
  date: string;
  log?: TimeLog;
  holiday?: string;
  onSave: (hours: number, notes: string) => Promise<void>;
  onClose: () => void;
}> = ({ date, log, holiday, onSave, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(log ? formatNumber(log.totalHours, 1) : '8');
  const [notes, setNotes] = useState(log?.notes ?? '');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="day-editor"
      aria-labelledby="day-editor-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            await onSave(Number(hours), notes);
            ref.current?.close();
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not save your hours.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="async-fields" disabled={busy}>
          <div className="table-header-row">
            <h3 id="day-editor-title">{date}</h3>
            <button
              type="button"
              className="btn-icon"
              onClick={() => ref.current?.close()}
              aria-label="Close day editor"
            >
              <X size={18} />
            </button>
          </div>
          {holiday && <p className="badge-holiday">{holiday}</p>}
          <label className="form-label" htmlFor="day-hours">
            Total hours
          </label>
          <input
            id="day-hours"
            className="form-input"
            type="number"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            min="0"
            max="24"
            step="0.1"
            required
            autoFocus
          />
          <label className="form-label" htmlFor="day-notes">
            Notes
          </label>
          <textarea
            id="day-notes"
            className="form-textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <div className="sample-actions">
            <button type="button" className="btn-secondary" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {busy ? 'Saving…' : 'Save hours'}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      </form>
    </dialog>
  );
};
