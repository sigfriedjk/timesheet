import React, { useEffect, useRef, useState } from 'react';
import { TimeLog } from '../types';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { MONTH_NAMES, getFederalHolidays } from '../utils/calendar';
import { roundToTenth } from '../utils/calculations';
import { formatNumber } from '../utils/format';
import { CalendarMonth } from './calendar/CalendarMonth';
import { DayEditor } from './calendar/DayEditor';
import { MonthAutofill } from './calendar/MonthAutofill';
import { SavedEntriesTable } from './calendar/SavedEntriesTable';
import { useTodayDate } from '../hooks/useTodayDate';

interface CalendarViewProps {
  logs: TimeLog[];
  isSample: boolean;
  onNavigateToCalculator: () => void;
  onDeleteLog: (date: string) => Promise<void>;
  onFillMonth: (month: string) => Promise<number>;
  busy: boolean;
  onSaveLog: (date: string, hours: number, notes: string) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  logs, isSample, onNavigateToCalculator, onDeleteLog, onSaveLog, onFillMonth, busy,
}) => {
  const today = useTodayDate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const remove = async (date: string) => {
    if (deleting) return;
    setDeleting(true); setError('');
    try { await onDeleteLog(date); } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete entry.'); } finally { setDeleting(false); }
  };
  const [selectedYear, setSelectedYear] = useState(isSample ? 2026 : new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const currentMonth = useRef<HTMLElement>(null);
  const [jumpRequest, setJumpRequest] = useState(0);
  useEffect(() => {
    if (jumpRequest) currentMonth.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedYear, jumpRequest]);
  const jumpToToday = () => { setSelectedYear(Number(today.slice(0, 4))); setJumpRequest(value => value + 1); };
  const [selectedMonth, setSelectedMonth] = useState(today.slice(5, 7));
  const entryYears = Array.from(new Set([selectedYear, Number(today.slice(0, 4)), ...logs.map(log => Number(log.date.slice(0, 4)))])).sort((a, b) => b - a);
  const yearlyLogs = logs.filter((log) => log.date.startsWith(`${selectedYear}-`)).sort((a, b) => b.date.localeCompare(a.date));
  const savedLogs = yearlyLogs.filter(log => selectedMonth === 'all' || log.date.slice(5, 7) === selectedMonth);
  const entriesPeriod = `${selectedMonth === 'all' ? 'all months in' : MONTH_NAMES[Number(selectedMonth) - 1]} ${selectedYear}`;
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
        <div className="kpi-card"><div className="kpi-heading"><span className="kpi-label">Logged hours</span><button type="button" className="btn-chip" onClick={jumpToToday}>Jump to today</button></div><span className="kpi-value">{formatNumber(totalYearHours, 1)}</span></div>
      </div>

      <MonthAutofill
        logs={logs}
        initialMonth={today.slice(0, 7)}
        disabled={busy || deleting}
        onFillMonth={onFillMonth}
        onFilled={month => {
          setSelectedYear(Number(month.slice(0, 4)));
          setSelectedMonth(month.slice(5, 7));
        }}
      />

      <div className="calendar-legend" aria-label="Calendar legend">
        <span><i className="legend-dot logged-dot" />Logged hours</span>
        <span><i className="legend-dot weekend-dot" />Weekend</span>
        <span><i className="legend-dot holiday-dot" />Federal holiday</span>
      </div>
      <div className="year-calendar">
        {MONTH_NAMES.map((_, month) => <CalendarMonth
          key={month}
          year={selectedYear}
          month={month}
          today={today}
          logs={yearlyLogs}
          logsByDate={logsByDate}
          elementRef={selectedYear === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7)) - 1 ? currentMonth : undefined}
          onSelectDate={setSelectedDate}
        />)}
      </div>

      <div className="calculator-card table-section">
        <div className="table-header-row"><div className="saved-entries-heading"><h3 className="card-title">Saved Entries for</h3><select className="form-input" aria-label="Saved entries month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)}><option value="all">All months</option>{MONTH_NAMES.map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}</select><select className="form-input" aria-label="Saved entries year" value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))}>{entryYears.map(year => <option key={year} value={year}>{year}</option>)}</select></div><button type="button" onClick={onNavigateToCalculator} className="btn-primary btn-small"><Plus size={16} />New Daily Log</button></div>
        {savedLogs.length === 0 ? (
          <div className="empty-state"><CalendarIcon size={40} className="empty-icon" /><p>No entries recorded for {entriesPeriod}.</p></div>
        ) : (
          <SavedEntriesTable logs={savedLogs} holidays={holidays} deleting={deleting} onEdit={setSelectedDate} onDelete={remove} />
        )}
      </div>
      {selectedDate && <DayEditor key={selectedDate} date={selectedDate} log={logsByDate.get(selectedDate)} holiday={holidays[selectedDate]} onClose={() => setSelectedDate(null)} onSave={(hours, notes) => onSaveLog(selectedDate, hours, notes)} />}
    </div>
  );
};

