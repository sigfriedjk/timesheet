import React, { useState, useEffect, useMemo } from 'react';
import {
  calculateWorkedHours,
  getShiftScenarios,
  timeStringToMinutes,
  getTodayDateString,
  getCurrentTimeString,
  normalizeTimeInput,
} from '../utils/calculations';
import { TimeLog } from '../types';
import { formatNumber } from '../utils/format';
import {
  Clock,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  FileText,
  ArrowLeft,
  ArrowRight,
  LockKeyholeOpen,
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
  const [breakMinutes, setBreakMinutes] = useState<number>(0);
  const [targetHoursInput, setTargetHoursInput] = useState<string>('8.5');
  const [targetMode, setTargetMode] = useState<'hours' | 'time'>('hours');
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

  // Worked hours calculation
  const workedCalc = useMemo(() => {
    return calculateWorkedHours(timeIn, timeOut, breakMinutes);
  }, [timeIn, timeOut, breakMinutes]);
  const validShift = timeStringToMinutes(timeIn) !== null && timeStringToMinutes(timeOut) !== null;

  const scenarios = useMemo(
    () => getShiftScenarios(timeIn, currentTimeStr, breakMinutes, targetHoursInput, targetOutTime),
    [timeIn, currentTimeStr, breakMinutes, targetHoursInput, targetOutTime]
  );
  const displayedTargetTime = targetMode === 'hours' ? scenarios.shift?.timeOut ?? '' : targetOutTime;
  const displayedTargetHours = targetMode === 'hours' ? targetHoursInput : scenarios.out ? formatNumber(scenarios.out.hours, 1) : '';
  const validOutTarget = timeStringToMinutes(normalizeTimeInput(displayedTargetTime)) !== null;
  const switchTargetMode = () => {
    if (targetMode === 'hours') { setTargetOutTime(displayedTargetTime); setTargetMode('time'); }
    else { setTargetHoursInput(displayedTargetHours); setTargetMode('hours'); }
  };

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
    if (busy || !validShift) return;
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
            Entry Creator
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
                  Entry Creator
                </button>
              </div>
            </div>

            {/* Time In */}
            <div className="form-group">
              <label htmlFor="time-in" className="form-label">
                <Clock size={16} />
                <span>Time In</span>
              </label>
              <div className="input-with-actions">
                <TimeInput24
                  id="time-in"
                  value={timeIn}
                  onValueChange={setTimeIn}
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
                <span>Time Out</span>
              </label>
              <div className="input-with-actions">
                <TimeInput24
                  id="time-out"
                  value={timeOut}
                  onValueChange={setTimeOut}
                  className="form-input"
                  aria-label="Time out"
                  required
                />
                <button type="button" onClick={handleSetTimeOutNow} className="btn-chip">Now</button>
                {timeOut && <button type="button" onClick={handleClearTimeOut} className="btn-chip">Clear</button>}
              </div>
            </div>

            {/* Break Duration (Minutes) */}
            <div className="form-group">
              <label htmlFor="break-mins" className="form-label">
                <Coffee size={16} />
                <span>Break (min)</span>
              </label>
              <div className="break-presets">
                <input
                  id="break-mins"
                  type="number"
                  min="0"
                  max="480"
                  step="1"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Math.min(480, Math.max(0, Number(e.target.value) || 0)))}
                  onBlur={() => setBreakMinutes(minutes => Math.ceil(minutes / 6) * 6)}
                  className="form-input custom-break-input"
                  aria-label="Custom break minutes"
                />
                {[0, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setBreakMinutes(mins)}
                    className="btn-chip"
                  >
                    {mins} min
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
                    {date} currently has <strong>{formatNumber(existingEntry.totalHours, 1)} hrs</strong> logged.
                    Saving will overwrite this entry with <strong>{validShift ? formatNumber(workedCalc.roundedHours, 1) : '—'} hrs</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="form-actions">
              <button type="submit" className="btn-primary btn-large" disabled={busy}>
                <CheckCircle2 size={20} />
                <span>{busy ? 'Saving…' : existingEntry ? 'Overwrite & Log Time' : 'Log Time to Database'}</span>
                <span className="btn-highlight">({validShift ? formatNumber(workedCalc.roundedHours, 1) : '—'} hrs)</span>
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
            hours={<span className="scenario-value">{formatNumber(scenarios.live?.hours, 1)}</span>}
          />
          <section className="calculator-card scenario-card out-target-card" aria-label="Out Target">
            <h3 className="card-title">Out Target</h3>
            <div className="target-controls">
              <label className="target-field" htmlFor="target-hours-input"><span>Hours <small>{targetMode === 'hours' ? 'Editable' : 'Calculated'}</small></span>
                <input id="target-hours-input" type="number" inputMode="decimal" step="0.1" min="0.1" max="24" value={displayedTargetHours} onChange={event => setTargetHoursInput(event.target.value)} readOnly={targetMode !== 'hours'} disabled={busy} className="scenario-input" aria-label="Target hours" aria-invalid={targetMode === 'hours' && targetHoursInput !== '' && !scenarios.shift} />
              </label>
              <button type="button" className="target-direction btn-icon" onClick={switchTargetMode} disabled={busy} aria-label={targetMode === 'hours' ? 'Edit time out and calculate hours' : 'Edit hours and calculate time out'} title={targetMode === 'hours' ? 'Hours editable. Switch to edit time out.' : 'Time out editable. Switch to edit hours.'}>
                <LockKeyholeOpen size={14} aria-hidden="true" />{targetMode === 'hours' ? <ArrowLeft size={22} aria-hidden="true" /> : <ArrowRight size={22} aria-hidden="true" />}
              </button>
              <label className="target-field" htmlFor="target-out-time"><span>Time out <small>{targetMode === 'time' ? 'Editable' : 'Calculated'}</small></span>
                <TimeInput24 id="target-out-time" value={displayedTargetTime} onValueChange={setTargetOutTime} readOnly={targetMode !== 'time'} disabled={busy} className="scenario-input" aria-label="Target out time" />
              </label>
            </div>
            <div className="scenario-actions"><button type="button" disabled={busy || !validOutTarget} onClick={() => setTimeOut(normalizeTimeInput(displayedTargetTime))} className="btn-chip">Use as Time Out</button></div>
            {targetMode === 'hours' && !scenarios.shift && <p className="scenario-hint">Enter 0.1 to 24 hours and a valid Time In.</p>}
          </section>
        </section>
      </div>
    </div>
  );
};

interface ScenarioCardProps {
  title: string;
  outTime: React.ReactNode;
  hours: React.ReactNode;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ title, outTime, hours }) => (
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
  </section>
);

// Text inputs keep HH:MM visible regardless of the browser's time-picker locale.
type TimeInput24Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { onValueChange: (value: string) => void };
const TimeInput24: React.FC<TimeInput24Props> = ({ onValueChange, onBlur, ...props }) => (
  <input
    {...props}
    type="text"
    inputMode="numeric"
    onChange={event => onValueChange(event.target.value)}
    onBlur={event => { if (!props.readOnly) onValueChange(normalizeTimeInput(event.currentTarget.value)); onBlur?.(event); }}
    placeholder="HH:MM"
    pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
    maxLength={5}
    title="24-hour time (HH:MM)"
    autoComplete="off"
    aria-invalid={Boolean(props.value) && timeStringToMinutes(String(props.value)) === null}
  />
);
