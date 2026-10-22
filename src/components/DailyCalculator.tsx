import React, { useState, useEffect, useMemo } from 'react';
import {
  calculateWorkedHours,
  getShiftScenarios,
  timeStringToMinutes,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/calculations';
import { TimeLog } from '../types';
import {
  Clock,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  FileText,
} from 'lucide-react';

interface DailyCalculatorProps {
  onLogSaved: (log: TimeLog) => Promise<void>;
  existingLogs: TimeLog[];
}

export const DailyCalculator: React.FC<DailyCalculatorProps> = ({
  onLogSaved,
  existingLogs,
}) => {
  // Ephemeral inputs (in-memory only, per design document)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [timeIn, setTimeIn] = useState<string>('08:00');
  const [timeOut, setTimeOut] = useState<string>('');
  const [targetOutTime, setTargetOutTime] = useState<string>('');
  const [breakMinutes, setBreakMinutes] = useState<number>(30);
  const [targetHoursInput, setTargetHoursInput] = useState<string>('8.5');
  const [notes, setNotes] = useState<string>('');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(getCurrentTimeString());

  // Update current time clock every 10 seconds for real-time calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeStr(getCurrentTimeString());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Check if an entry already exists for the selected date
  const existingEntry = useMemo(() => {
    return existingLogs.find((l) => l.date === date);
  }, [existingLogs, date]);

  // Effective end time: entered timeOut or current clock time
  const effectiveTimeOut = timeOut.trim() !== '' ? timeOut : currentTimeStr;

  // Worked hours calculation
  const workedCalc = useMemo(() => {
    return calculateWorkedHours(timeIn, effectiveTimeOut, breakMinutes);
  }, [timeIn, effectiveTimeOut, breakMinutes]);

  const scenarios = useMemo(
    () => getShiftScenarios(timeIn, currentTimeStr, breakMinutes, targetHoursInput, targetOutTime),
    [timeIn, currentTimeStr, breakMinutes, targetHoursInput, targetOutTime]
  );

  const handleSetTimeInNow = () => {
    setTimeIn(getCurrentTimeString());
  };

  const handleSetTimeOutNow = () => {
    setTimeOut(getCurrentTimeString());
  };

  const handleClearTimeOut = () => {
    setTimeOut('');
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await onLogSaved(
      {
        id: existingEntry?.id || '',
        date,
        totalHours: workedCalc.roundedHours,
        notes: notes.trim() || undefined,
        createdAt: existingEntry?.createdAt || '',
        updatedAt: '',
      }
    );
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your hours.'); }
    finally { setBusy(false); }
  };

  const isToday = date === getTodayDateString();

  return (
    <div className="calculator-view">
      {/* Page Title & Status Banner */}
      <div className="view-header">
        <div>
          <h2>Daily Calculator & Projections</h2>
        </div>
        <div className="current-clock-pill">
          <Clock size={16} />
          <span>Current Time: <strong>{currentTimeStr}</strong></span>
        </div>
      </div>

      <div className="calculator-layout">
        {/* Left Column: Form Controls */}
        <section className="calculator-card form-section" aria-labelledby="controls-heading">
          <h3 id="controls-heading" className="card-title">
            Shift Details
          </h3>

          <form onSubmit={handleLogSubmit} className="calculator-form">
            <fieldset className="async-fields" disabled={busy}>
            {/* Date Input */}
            <div className="form-group">
              <label htmlFor="log-date" className="form-label">
                <CalendarIcon size={16} />
                <span>Shift Date</span>
              </label>
              <div className="input-with-actions">
                <input
                  id="log-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setDate(getTodayDateString())}
                  className={`btn-chip ${isToday ? 'chip-active' : ''}`}
                >
                  Today
                </button>
              </div>
            </div>

            {/* Time In */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="time-in" className="form-label">
                  <Clock size={16} />
                  <span>Time In</span>
                </label>
              </div>
              <div className="input-with-actions">
                <TimeInput24
                  id="time-in"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                  className="form-input"
                  required
                  aria-label="Time in"
                />
                <button
                  type="button"
                  onClick={handleSetTimeInNow}
                  className="btn-chip"
                  title="Set to current local time"
                >
                  Now
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="time-out" className="form-label">
                <Clock size={16} />
                <span>Time Out (Optional)</span>
              </label>
              <div className="input-with-actions">
                <TimeInput24
                  id="time-out"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                  className="form-input"
                  aria-label="Time out"
                  aria-describedby="time-out-hint"
                />
                <button type="button" onClick={handleSetTimeOutNow} className="btn-chip">Now</button>
                {timeOut && <button type="button" onClick={handleClearTimeOut} className="btn-chip chip-clear">Clear</button>}
              </div>
              <small id="time-out-hint" className="label-help">Leave blank to log through the current time.</small>
            </div>

            {/* Break Duration (Minutes) */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="break-mins" className="form-label">
                  <Coffee size={16} />
                  <span>Break / Lunch Duration</span>
                </label>
                <span className="label-badge">{(breakMinutes / 60).toFixed(1)} hr · {breakMinutes} min</span>
              </div>
              <div className="break-presets">
                {[0, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setBreakMinutes(mins)}
                    className={`btn-chip ${breakMinutes === mins ? 'chip-active' : ''}`}
                  >
                    {mins === 0 ? 'No Break' : `${(mins / 60).toFixed(1)} hr (${mins}m)`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBreakMinutes((minutes) => Math.max(0, minutes - 6))}
                  disabled={breakMinutes === 0}
                  className="btn-chip"
                  aria-label="Subtract 6 minutes (0.1 hour)"
                  title="Subtract 6 minutes (0.1 hour)"
                >−</button>
                <button
                  type="button"
                  onClick={() => setBreakMinutes((minutes) => Math.min(480, minutes + 6))}
                  disabled={breakMinutes === 480}
                  className="btn-chip"
                  aria-label="Add 6 minutes (0.1 hour)"
                  title="Add 6 minutes (0.1 hour)"
                >+</button>
                <input
                  id="break-mins"
                  type="number"
                  min="0"
                  max="480"
                  step="1"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Math.min(480, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="form-input custom-break-input"
                  aria-label="Custom break minutes"
                />
              </div>
            </div>

            {/* Optional Notes */}
            <div className="form-group">
              <label htmlFor="log-notes" className="form-label">
                <FileText size={16} />
                <span>Notes (Optional)</span>
              </label>
              <textarea
                id="log-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Sprint planning, prime contract tasks..."
                className="form-textarea"
              />
            </div>

            {/* Overwrite Banner if date already has a log */}
            {existingEntry && (
              <div className="alert-box alert-warning" role="alert">
                <AlertTriangle size={18} />
                <div>
                  <strong>Existing Entry Detected:</strong>
                  <p>
                    {date} currently has <strong>{existingEntry.totalHours.toFixed(1)} hrs</strong> logged.
                    Saving will overwrite this entry with <strong>{workedCalc.roundedHours.toFixed(1)} hrs</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="form-actions">
              <button type="submit" className="btn-primary btn-large" disabled={busy}>
                <CheckCircle2 size={20} />
                <span>{busy ? 'Saving…' : existingEntry ? 'Overwrite & Log Time' : 'Log Time to Database'}</span>
                <span className="btn-highlight">({workedCalc.roundedHours.toFixed(1)} hrs)</span>
              </button>

            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            </fieldset>
          </form>
        </section>

        <section className="scenario-list" aria-label="Departure scenarios">
          <ScenarioCard
            title="Live Calculation"
            outTime={<span className="scenario-value">{currentTimeStr}</span>}
            hours={<span className="scenario-value">{scenarios.live?.hours.toFixed(1) ?? '—'}</span>}
          />
          <ScenarioCard
            title="Shift Target"
            outTime={<span className="scenario-value">{scenarios.shift ? scenarios.shift.timeOut : '—'}</span>}
            hours={
              <input
                id="target-hours-input"
                type="number"
                step="0.1"
                min="0.1"
                max="24"
                value={targetHoursInput}
                onChange={(e) => setTargetHoursInput(e.target.value)}
                className="scenario-input"
                aria-label="Target hours"
                aria-invalid={targetHoursInput !== '' && !scenarios.shift}
                aria-describedby={!scenarios.shift ? 'target-hours-hint' : undefined}
              />
            }
            hint={!scenarios.shift ? <p id="target-hours-hint" className="scenario-hint">Enter 0.1 to 24 hours and a valid time in.</p> : undefined}
          />
          <ScenarioCard
            title="Out Target"
            outTime={
              <TimeInput24
                id="target-out-time"
                value={targetOutTime}
                onChange={(e) => setTargetOutTime(e.target.value)}
                className="scenario-input"
                aria-label="Target out time"
              />
            }
            hours={<span className="scenario-value">{scenarios.out?.hours.toFixed(1) ?? '—'}</span>}
            actions={
              <>
                <button type="button" onClick={() => setTargetOutTime(getCurrentTimeString())} className="btn-chip">Now</button>
                {targetOutTime && <button type="button" onClick={() => setTargetOutTime('')} className="btn-chip chip-clear">Clear</button>}
              </>
            }
          />
        </section>
      </div>
    </div>
  );
};

interface ScenarioCardProps {
  title: string;
  outTime: React.ReactNode;
  hours: React.ReactNode;
  actions?: React.ReactNode;
  hint?: React.ReactNode;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ title, outTime, hours, actions, hint }) => (
  <section className="calculator-card scenario-card" aria-label={title}>
    <h3 className="card-title">{title}</h3>
    <dl className="scenario-pair">
      <div className="scenario-field">
        <dt>Out time</dt>
        <dd>{outTime}</dd>
      </div>
      <div className="scenario-field">
        <dt>Hours</dt>
        <dd>{hours}</dd>
      </div>
    </dl>
    {actions && <div className="scenario-actions">{actions}</div>}
    {hint}
  </section>
);

// Text inputs keep HH:MM visible regardless of the browser's time-picker locale.
const TimeInput24: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    type="text"
    placeholder="HH:MM"
    pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
    maxLength={5}
    title="24-hour time (HH:MM)"
    autoComplete="off"
    aria-invalid={Boolean(props.value) && timeStringToMinutes(String(props.value)) === null}
  />
);
