import React, { useState } from 'react';
import { TimeLog } from '../types';
import { Calendar as CalendarIcon, ArrowLeft, Trash2, Edit3, Plus } from 'lucide-react';

interface CalendarViewProps {
  logs: TimeLog[];
  onNavigateToCalculator: () => void;
  onDeleteLog: (date: string) => void;
  onEditLog: (log: TimeLog) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  logs,
  onNavigateToCalculator,
  onDeleteLog,
  onEditLog,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Filter logs for selected year
  const yearlyLogs = logs.filter((l) => l.date.startsWith(`${selectedYear}-`));
  const totalYearHours = yearlyLogs.reduce((sum, l) => sum + l.totalHours, 0);

  // US Federal Holidays for reference
  const federalHolidays: Record<string, string> = {
    '01-01': "New Year's Day",
    '01-19': 'Martin Luther King Jr. Day',
    '02-16': "Presidents' Day",
    '05-25': 'Memorial Day',
    '06-19': 'Juneteenth',
    '07-04': 'Independence Day',
    '09-07': 'Labor Day',
    '10-12': 'Columbus Day',
    '11-11': 'Veterans Day',
    '11-26': 'Thanksgiving Day',
    '12-25': 'Christmas Day',
  };

  return (
    <div className="calendar-view">
      <div className="view-header">
        <div>
          <h2>12-Month Calendar & Historical Entries</h2>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={onNavigateToCalculator}
            className="btn-secondary"
          >
            <ArrowLeft size={16} />
            <span>Open Calculator</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="calendar-kpi-strip">
        <div className="kpi-card">
          <span className="kpi-label">Year</span>
          <div className="year-selector">
            <button
              type="button"
              onClick={() => setSelectedYear(selectedYear - 1)}
              className="btn-icon"
              title="Previous Year"
            >
              &larr;
            </button>
            <span className="kpi-value">{selectedYear}</span>
            <button
              type="button"
              onClick={() => setSelectedYear(selectedYear + 1)}
              className="btn-icon"
              title="Next Year"
            >
              &rarr;
            </button>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Logged Entries</span>
          <span className="kpi-value">{yearlyLogs.length}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Total Logged Hours</span>
          <span className="kpi-value">{totalYearHours.toFixed(1)} hrs</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Accrued Leave Rate</span>
          <span className="kpi-value">0.0851 / hr</span>
        </div>
      </div>

      {/* Entries List / Table */}
      <div className="calculator-card table-section">
        <div className="table-header-row">
          <h3 className="card-title">Saved Entries for {selectedYear}</h3>
          <button
            type="button"
            onClick={onNavigateToCalculator}
            className="btn-primary btn-small"
          >
            <Plus size={16} />
            <span>New Daily Log</span>
          </button>
        </div>

        {yearlyLogs.length === 0 ? (
          <div className="empty-state">
            <CalendarIcon size={48} className="empty-icon" />
            <p className="empty-title">No entries recorded for {selectedYear} yet</p>
            <p className="empty-subtitle">
              Use the Daily Calculator to record work hours. Daily logs will automatically appear here.
            </p>
            <button
              type="button"
              onClick={onNavigateToCalculator}
              className="btn-primary"
            >
              Go to Daily Calculator
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day of Week</th>
                  <th>Total Hours (0.1)</th>
                  <th>Holiday Status</th>
                  <th>Notes</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {yearlyLogs.map((log) => {
                  const dateObj = new Date(log.date + 'T00:00:00');
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                  const monthDayKey = log.date.substring(5);
                  const holidayName = federalHolidays[monthDayKey];

                  return (
                    <tr
                      key={log.id}
                      className={`${isWeekend ? 'weekend-row' : ''} ${holidayName ? 'holiday-row' : ''}`}
                    >
                      <td>
                        <strong>{log.date}</strong>
                      </td>
                      <td>
                        <span className={`day-tag ${isWeekend ? 'tag-weekend' : ''}`}>
                          {dayName}
                        </span>
                      </td>
                      <td>
                        <span className="hours-badge">{log.totalHours.toFixed(1)} hrs</span>
                      </td>
                      <td>
                        {holidayName ? (
                          <span className="badge badge-holiday">{holidayName}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="log-notes-cell">{log.notes || '—'}</span>
                      </td>
                      <td>
                        <span className="timestamp-cell">
                          {log.updatedAt ? new Date(log.updatedAt).toLocaleTimeString() : '—'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => onEditLog(log)}
                            className="btn-icon"
                            title="Edit in Calculator"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteLog(log.date)}
                            className="btn-icon btn-danger"
                            title="Delete Entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
