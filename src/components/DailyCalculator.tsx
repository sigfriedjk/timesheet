import React, { useState, useEffect, useMemo } from 'react';
import {
  calculateWorkedHours,
  calculateTargetTimeOut,
  roundToTenth,
  timeStringToMinutes,
  formatTime12Hour,
  getTodayDateString,
  getCurrentTimeString,
  formatDurationMinutes,
} from '../utils/calculations';
import { TimeLog } from '../types';
import {
  Clock,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar as CalendarIcon,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface DailyCalculatorProps {
  onLogSaved: (log: TimeLog, isOverwrite: boolean, transitionToCalendar: boolean) => void;
  existingLogs: TimeLog[];
}

export const DailyCalculator: React.FC<DailyCalculatorProps> = ({
  onLogSaved,
  existingLogs,
}) => {
  // Ephemeral inputs (in-memory only, per design document)
  const [date, setDate] = useState<string>(getTodayDateString());
  const [timeIn, setTimeIn] = useState<string>('08:00');
  const [timeOut, setTimeOut] = useState<string>('');
  const [breakMinutes, setBreakMinutes] = useState<number>(30);
  const [customTarget, setCustomTarget] = useState<number>(8.5);
  const [notes, setNotes] = useState<string>('');
  const [autoTransition, setAutoTransition] = useState<boolean>(true);
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
  const isUsingCurrentTime = timeOut.trim() === '';

  // Worked hours calculation
  const workedCalc = useMemo(() => {
    return calculateWorkedHours(timeIn, effectiveTimeOut, breakMinutes);
  }, [timeIn, effectiveTimeOut, breakMinutes]);

  // Calculations for target goals (8.0, 9.6, and Custom)
  const targets = useMemo(() => {
    const goals = [
      { hours: 8.0, label: 'Standard Shift (8.0 hrs)' },
      { hours: 9.6, label: '9/80 Long Shift (9.6 hrs)' },
      { hours: customTarget, label: `Custom Goal (${roundToTenth(customTarget)} hrs)` },
    ];

    const currentMinutesFromMidnight = isUsingCurrentTime
      ? timeStringToMinutes(currentTimeStr) || 0
      : timeStringToMinutes(timeOut) || 0;

    return goals.map((g) => {
      const calc = calculateTargetTimeOut(timeIn, g.hours, breakMinutes);
      const targetMin = calc ? calc.totalTargetMinutesFromMidnight : 0;
      let remaining = targetMin - currentMinutesFromMidnight;
      if (remaining < 0) remaining = 0;

      const progress =
        g.hours > 0 ? Math.min(100, Math.max(0, (workedCalc.roundedHours / g.hours) * 100)) : 0;

      return {
        ...g,
        targetTime12: calc ? calc.timeOut12 : '--:--',
        targetTime24: calc ? calc.timeOut24 : '--:--',
        remainingMinutes: remaining,
        isReached: workedCalc.roundedHours >= g.hours,
        progressPercent: Math.round(progress),
      };
    });
  }, [timeIn, breakMinutes, customTarget, isUsingCurrentTime, currentTimeStr, timeOut, workedCalc.roundedHours]);

  const handleSetTimeInNow = () => {
    setTimeIn(getCurrentTimeString());
  };

  const handleSetTimeOutNow = () => {
    setTimeOut(getCurrentTimeString());
  };

  const handleClearTimeOut = () => {
    setTimeOut('');
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onLogSaved(
      {
        id: existingEntry?.id || '',
        date,
        totalHours: workedCalc.roundedHours,
        notes: notes.trim() || undefined,
        createdAt: existingEntry?.createdAt || '',
        updatedAt: '',
      },
      Boolean(existingEntry),
      autoTransition
    );
    return result;
  };

  const isToday = date === getTodayDateString();

  return (
    <div className="calculator-view">
      {/* Page Title & Status Banner */}
      <div className="view-header">
        <div>
          <h2>Daily Calculator & Projections</h2>
          <p className="view-description">
            Interface 1: Ephemeral shift calculation, target completion forecasting, and single-click daily logging.
          </p>
        </div>
        <div className="current-clock-pill">
          <Clock size={16} />
          <span>Current Time: <strong>{formatTime12Hour(currentTimeStr)}</strong></span>
        </div>
      </div>

      <div className="calculator-layout">
        {/* Left Column: Form Controls */}
        <section className="calculator-card form-section" aria-labelledby="controls-heading">
          <h3 id="controls-heading" className="card-title">
            Shift Parameters (Ephemeral)
          </h3>
          <p className="card-subtitle">
            Values are maintained in-memory. Only final rounded hours are committed upon logging.
          </p>

          <form onSubmit={handleLogSubmit} className="calculator-form">
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
                <span className="label-help">24-hour format</span>
              </div>
              <div className="input-with-actions">
                <input
                  id="time-in"
                  type="time"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  onClick={handleSetTimeInNow}
                  className="btn-chip"
                  title="Set to current local time"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={() => setTimeIn('08:00')}
                  className="btn-chip"
                  title="Preset 08:00 AM"
                >
                  8:00 AM
                </button>
              </div>
            </div>

            {/* Time Out (Optional) */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="time-out" className="form-label">
                  <Clock size={16} />
                  <span>Time Out (Optional)</span>
                </label>
                <span className="label-help">
                  {isUsingCurrentTime ? 'Auto-calculating using current time' : 'Fixed end time'}
                </span>
              </div>
              <div className="input-with-actions">
                <input
                  id="time-out"
                  type="time"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                  className={`form-input ${isUsingCurrentTime ? 'input-dimmed' : ''}`}
                  placeholder="--:--"
                />
                <button
                  type="button"
                  onClick={handleSetTimeOutNow}
                  className="btn-chip"
                  title="Set Time Out to now"
                >
                  Now
                </button>
                {timeOut && (
                  <button
                    type="button"
                    onClick={handleClearTimeOut}
                    className="btn-chip chip-clear"
                    title="Clear and resume real-time tracking"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Break Duration (Minutes) */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="break-mins" className="form-label">
                  <Coffee size={16} />
                  <span>Break / Lunch Duration (Minutes)</span>
                </label>
                <span className="label-badge">{breakMinutes} mins</span>
              </div>
              <div className="break-presets">
                {[0, 15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setBreakMinutes(mins)}
                    className={`btn-chip ${breakMinutes === mins ? 'chip-active' : ''}`}
                  >
                    {mins === 0 ? 'No Break' : `${mins}m`}
                  </button>
                ))}
                <input
                  id="break-mins"
                  type="number"
                  min="0"
                  max="480"
                  step="5"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
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
              <button type="submit" className="btn-primary btn-large">
                <CheckCircle2 size={20} />
                <span>{existingEntry ? 'Overwrite & Log Time' : 'Log Time to Database'}</span>
                <span className="btn-highlight">({workedCalc.roundedHours.toFixed(1)} hrs)</span>
              </button>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoTransition}
                  onChange={(e) => setAutoTransition(e.target.checked)}
                />
                <span>Auto-transition to Calendar History view upon save</span>
              </label>
            </div>
          </form>
        </section>

        {/* Right Column: Live Target Cards & Real-Time Projections */}
        <section className="projections-section" aria-labelledby="projections-heading">
          {/* Live Status Card: "If you leave now..." */}
          <div className="calculator-card status-card">
            <div className="status-header">
              <span className="status-label">Live Calculation Status</span>
              <span className="precision-pill">ROUND to 0.1 hr</span>
            </div>

            <div className="status-main">
              <div className="status-hours">
                <span className="big-number">{workedCalc.roundedHours.toFixed(1)}</span>
                <span className="hours-unit">hours</span>
              </div>
              <div className="status-subtext">
                {isUsingCurrentTime ? (
                  <p className="leave-now-text">
                    <Sparkles size={16} className="inline-icon" />
                    <strong>If you leave now:</strong> you will log{' '}
                    <span className="highlight-val">{workedCalc.roundedHours.toFixed(1)} hrs</span>
                    <br />
                    <small>(Raw: {workedCalc.rawHours.toFixed(3)} hrs, Break: {breakMinutes}m)</small>
                  </p>
                ) : (
                  <p className="fixed-shift-text">
                    Fixed calculation from <strong>{formatTime12Hour(timeIn)}</strong> to{' '}
                    <strong>{formatTime12Hour(timeOut)}</strong> (minus {breakMinutes}m break)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Target Cards */}
          <div className="targets-container">
            <div className="targets-header">
              <h3 id="projections-heading" className="card-title">
                Shift Target Projections
              </h3>
              <div className="custom-target-control">
                <label htmlFor="custom-target-input">Custom Target:</label>
                <input
                  id="custom-target-input"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="24"
                  value={customTarget}
                  onChange={(e) => setCustomTarget(parseFloat(e.target.value) || 8.0)}
                  className="target-num-input"
                />
                <span>hrs</span>
              </div>
            </div>

            <div className="target-cards-grid">
              {targets.map((target, idx) => (
                <div
                  key={idx}
                  className={`target-card ${target.isReached ? 'target-reached' : ''}`}
                >
                  <div className="target-card-top">
                    <span className="target-label">{target.label}</span>
                    {target.isReached ? (
                      <span className="badge badge-success">Target Reached</span>
                    ) : (
                      <span className="badge badge-pending">
                        {formatDurationMinutes(target.remainingMinutes)} remaining
                      </span>
                    )}
                  </div>

                  <div className="target-time-display">
                    <span className="target-time-label">Target Time Out:</span>
                    <span className="target-time-val">{target.targetTime12}</span>
                  </div>

                  <div className="progress-bar-container" aria-hidden="true">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${target.progressPercent}%` }}
                    />
                  </div>
                  <div className="progress-meta">
                    <span>{target.progressPercent}% completed</span>
                    <span>Goal: {target.hours.toFixed(1)} hrs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Explanation Card */}
          <div className="calculator-card info-card">
            <div className="info-header">
              <HelpCircle size={16} />
              <h4>How Projections Work (Design Section 6.1)</h4>
            </div>
            <ul className="info-list">
              <li>
                <strong>Raw Duration:</strong> <code>(Time Out - Time In - Break Minutes) / 60</code>
              </li>
              <li>
                <strong>Tenth-Hour Rounding:</strong> <code>ROUND(Raw Hours * 10) / 10</code>
              </li>
              <li>
                <strong>Estimated Time Out:</strong> <code>Time In + Target Hours + Break Minutes</code>
              </li>
              <li>
                <strong>Repeated Logs:</strong> Logging multiple times throughout the day safely updates the total hours for that day.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
