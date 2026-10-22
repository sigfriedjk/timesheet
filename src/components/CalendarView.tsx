import React, { useEffect, useRef, useState } from 'react';
import { TimeLog } from '../types';
import { Calendar as CalendarIcon, Trash2, Edit3, Plus, X } from 'lucide-react';
import { MONTH_NAMES, WEEKDAY_NAMES, getFederalHolidays, getMonthCells, getMonthSummary } from '../utils/calendar';
import { roundToTenth } from '../utils/calculations';

interface CalendarViewProps {
  logs: TimeLog[];
  isSample: boolean;
  onNavigateToCalculator: () => void;
  onDeleteLog: (date: string) => Promise<void>;
  onSaveLog: (date: string, hours: number, notes: string) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  logs, isSample, onNavigateToCalculator, onDeleteLog, onSaveLog,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const remove = async (date: string) => {
    if (deleting) return;
    setDeleting(true); setError('');
    try { await onDeleteLog(date); } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete entry.'); } finally { setDeleting(false); }
  };
  const [selectedYear, setSelectedYear] = useState(isSample ? 2026 : new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const yearlyLogs = logs.filter((log) => log.date.startsWith(`${selectedYear}-`)).sort((a, b) => b.date.localeCompare(a.date));
  const logsByDate = new Map(yearlyLogs.map((log) => [log.date, log]));
  const holidays = getFederalHolidays(selectedYear);
  const totalYearHours = roundToTenth(yearlyLogs.reduce((sum, log) => sum + log.totalHours, 0));

  return (
    <div className="calendar-view">
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="calendar-kpi-strip">
        <div className="kpi-card">
          <span className="kpi-label">Year</span>
          <div className="year-selector">
            <button type="button" className="btn-icon" onClick={() => setSelectedYear(selectedYear - 1)} aria-label="Previous year">←</button>
            <span className="kpi-value">{selectedYear}</span>
            <button type="button" className="btn-icon" onClick={() => setSelectedYear(selectedYear + 1)} aria-label="Next year">→</button>
          </div>
        </div>
        <div className="kpi-card"><span className="kpi-label">Logged days</span><span className="kpi-value">{yearlyLogs.filter((log) => log.totalHours > 0).length}</span></div>
        <div className="kpi-card"><span className="kpi-label">Logged hours</span><span className="kpi-value">{totalYearHours.toFixed(1)}</span></div>
      </div>

      <div className="calendar-legend" aria-label="Calendar legend">
        <span><i className="legend-dot logged-dot" />Logged hours</span>
        <span><i className="legend-dot weekend-dot" />Weekend</span>
        <span><i className="legend-dot holiday-dot" />Federal holiday</span>
      </div>
      <div className="year-calendar">
        {MONTH_NAMES.map((monthName, month) => {
          const summary = getMonthSummary(yearlyLogs, selectedYear, month);
          return (
            <section key={month} className="month-calendar calculator-card" aria-label={`${monthName} ${selectedYear}`}>
              <div className="month-heading"><h3>{monthName}</h3><span>{summary.hours.toFixed(1)} h</span></div>
              <div className="month-weekdays" aria-hidden="true">{WEEKDAY_NAMES.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="month-days">
                {getMonthCells(selectedYear, month).map((day, index) => {
                  if (!day) return <span className="calendar-padding" key={`blank-${index}`} aria-hidden="true" />;
                  const log = logsByDate.get(day.date);
                  const label = `${monthName} ${day.day}, ${selectedYear}: ${log ? `${log.totalHours.toFixed(1)} hours` : 'no entry'}${day.holiday ? `; ${day.holiday}` : ''}`;
                  return (
                    <button key={day.date} type="button" onClick={() => setSelectedDate(day.date)}
                      className={`calendar-day${day.isWeekend ? ' calendar-weekend' : ''}${day.holiday ? ' calendar-holiday' : ''}${log ? ' calendar-logged' : ''}`}
                      aria-label={label} title={`${label}${log?.notes ? `; ${log.notes}` : ''}`}>
                      <span className="calendar-date">{day.day}{day.holiday && <span className="holiday-marker" aria-hidden="true">•</span>}</span>
                      <span className="calendar-hours">{log ? log.totalHours.toFixed(1) : '—'}</span>
                    </button>
                  );
                })}
              </div>

            </section>
          );
        })}
      </div>

      <div className="calculator-card table-section">
        <div className="table-header-row"><h3 className="card-title">Saved Entries for {selectedYear}</h3><button type="button" onClick={onNavigateToCalculator} className="btn-primary btn-small"><Plus size={16} />New Daily Log</button></div>
        {yearlyLogs.length === 0 ? (
          <div className="empty-state"><CalendarIcon size={40} className="empty-icon" /><p>No entries recorded for {selectedYear}.</p></div>
        ) : (
          <div className="table-responsive"><table className="logs-table">
            <thead><tr><th>Date</th><th>Day</th><th>Hours</th><th>Holiday</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>{yearlyLogs.map((log) => {
              const date = new Date(`${log.date}T12:00:00`);
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              return <tr key={log.id} className={`${weekend ? 'weekend-row' : ''} ${holidays[log.date] ? 'holiday-row' : ''}`}>
                <td>{log.date}</td><td>{date.toLocaleDateString('en-US', { weekday: 'short' })}</td><td><span className="hours-badge">{log.totalHours.toFixed(1)}</span></td>
                <td>{holidays[log.date] ? <span className="badge badge-holiday">{holidays[log.date]}</span> : '—'}</td><td className="log-notes-cell">{log.notes || '—'}</td>
                <td><div className="row-actions"><button type="button" className="btn-icon" onClick={() => setSelectedDate(log.date)} aria-label={`Edit ${log.date}`}><Edit3 size={16} /></button><button type="button" className="btn-icon btn-danger" disabled={deleting} onClick={() => void remove(log.date)} aria-label={`Delete ${log.date}`}><Trash2 size={16} /></button></div></td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </div>
      {selectedDate && <DayEditor key={selectedDate} date={selectedDate} log={logsByDate.get(selectedDate)} holiday={holidays[selectedDate]} onClose={() => setSelectedDate(null)} onSave={(hours, notes) => onSaveLog(selectedDate, hours, notes)} />}
    </div>
  );
};

const DayEditor: React.FC<{ date: string; log?: TimeLog; holiday?: string; onSave: (hours: number, notes: string) => Promise<void>; onClose: () => void }> = ({ date, log, holiday, onSave, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(log?.totalHours.toFixed(1) ?? '8.0');
  const [notes, setNotes] = useState(log?.notes ?? '');
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="day-editor" aria-labelledby="day-editor-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <form onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError('');
      try { await onSave(Number(hours), notes); ref.current?.close(); }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not save your hours.'); }
      finally { setBusy(false); }
    }}><fieldset className="async-fields" disabled={busy}>
      <div className="table-header-row"><h3 id="day-editor-title">{date}</h3><button type="button" className="btn-icon" onClick={() => ref.current?.close()} aria-label="Close day editor"><X size={18} /></button></div>
      {holiday && <p className="badge-holiday">{holiday}</p>}
      <label className="form-label" htmlFor="day-hours">Total hours</label>
      <input id="day-hours" className="form-input" type="number" value={hours} onChange={(event) => setHours(event.target.value)} min="0" max="24" step="0.1" required autoFocus />
      <label className="form-label" htmlFor="day-notes">Notes</label>
      <textarea id="day-notes" className="form-textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      <div className="sample-actions"><button type="button" className="btn-secondary" onClick={() => ref.current?.close()}>Cancel</button><button type="submit" className="btn-primary">{busy ? 'Saving…' : 'Save hours'}</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </fieldset></form>
  </dialog>;
};
