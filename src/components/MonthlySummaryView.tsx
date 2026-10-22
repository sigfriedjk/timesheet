import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Edit3, X } from 'lucide-react';
import { LeaveBalance, MonthlyRow, buildMonthlySummary } from '../utils/monthlySummary';
import { LeaveCategory, MonthlyReportState, TimeLog } from '../types';
import { MONTH_NAMES, calendarDate } from '../utils/calendar';
import { generateId } from '../services/storage';
import { SAMPLE_YEAR } from '../services/sampleData';
import { useTodayDate } from '../hooks/useTodayDate';
import { LEAVE_FIELDS, enteredMonthTotal, setEnteredMonthTotal } from '../utils/monthlyEntries';

interface Props {
  logs: TimeLog[];
  state: MonthlyReportState;
  isSample: boolean;
  onChange: (state: MonthlyReportState) => Promise<void>;
}
const fixed = (value: number | null | undefined, digits = 2) => value == null ? '—' : String(Number(value.toFixed(digits)));
const BalanceDetail: React.FC<{ value: LeaveBalance | null }> = ({ value }) => value
  ? <dl className="leave-breakdown">{(['pto', 'holiday', 'birthday'] as const).map(category => <div key={category}><dt>{category === 'pto' ? 'PTO' : category === 'holiday' ? 'Holiday' : 'Birthday'}</dt><dd data-stat={`leave-${category}`} className={value[category] < 0 ? 'negative-value' : ''}>{fixed(value[category])}<small> h</small></dd></div>)}</dl>
  : <span>Set an opening month and balances in Settings.</span>;
const Cell: React.FC<{ value: number | null | undefined; digits?: number; className?: string; title?: string }> = ({ value, digits = 2, className = '', title }) =>
  <td className={`${className} ${value != null && value < 0 ? 'negative-value' : ''}`} title={title}>{fixed(value, digits)}</td>;

export const MonthlySummaryView: React.FC<Props> = ({ logs, state, isSample, onChange }) => {
  const asOf = useTodayDate();
  const [year, setYear] = useState(isSample ? SAMPLE_YEAR : Number(asOf.slice(0, 4)));
  const [editing, setEditing] = useState<string | null>(null);
  const [showAccrued, setShowAccrued] = useState(false);
  const [saving, setSaving] = useState(false);
  const editButton = useRef<HTMLButtonElement | null>(null);
  const closeEditor = () => { setEditing(null); requestAnimationFrame(() => editButton.current?.focus()); };
  const editMonth = (key: string, button: HTMLButtonElement) => { editButton.current = button; setEditing(key); };
  const report = useMemo(() => buildMonthlySummary(logs, state, year, asOf), [logs, state, year, asOf]);
  const t = report.totals;
  const december = report.rows[11];
  return <div className="monthly-view">
    <div className="monthly-toolbar">
      <div className="year-selector" aria-label="Summary year">
        <button type="button" className="btn-icon" aria-label="Previous summary year" disabled={saving} onClick={() => { setYear(year - 1); setEditing(null); }}>←</button>
        <strong>{year}</strong>
        <button type="button" className="btn-icon" aria-label="Next summary year" disabled={saving} onClick={() => { setYear(year + 1); setEditing(null); }}>→</button>
      </div>
      <button type="button" className="btn-secondary accrual-toggle" aria-expanded={showAccrued} aria-controls="monthly-summary-table" onClick={() => setShowAccrued(!showAccrued)}>{showAccrued ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{showAccrued ? 'Hide accrued' : 'Show accrued'}</button>
    </div>
    <div className="monthly-stats">
      <div className="summary-stat"><span className="summary-label">Logged year hours</span><strong data-stat="year-hours">{fixed(t.actualHours, 1)}</strong></div>
      <div className="summary-stat"><span className="summary-label">Leave balance</span><BalanceDetail value={report.currentBalance} /></div>
      <div className="summary-stat"><span className="summary-label">Forecast year total</span><strong data-stat="forecast-year-hours">{fixed(t.workHours, 1)} <small>h</small></strong></div>
    </div>
    {editing && <MonthEditor key={editing} row={report.rows.find(row => row.key === editing)!} asOf={asOf} state={state} onChange={onChange} onClose={closeEditor} onSaving={setSaving} />}
    <div className="monthly-table-scroll" tabIndex={0} aria-label="Monthly work and leave summary; scroll horizontally for all columns">
      <table className="monthly-table" id="monthly-summary-table">
        <thead>
          <tr><th rowSpan={2} className="month-column" scope="col">Month</th><th colSpan={6} scope="colgroup">Work & trailing 12 months</th>{showAccrued && <th colSpan={3} scope="colgroup" className="accrual-group">Accrued</th>}<th colSpan={4} scope="colgroup" className="usage-group">Used / planned leave</th><th rowSpan={2} scope="col">PTO adj.</th><th colSpan={3} scope="colgroup" className="balance-group">End-of-month balances</th></tr>
          <tr>{['Weekday h', 'Holidays', 'Logged h', 'Work total', '12m total', 'Leave needed', ...(showAccrued ? ['PTO', 'Holiday', 'Birthday'] : []), 'PTO', 'Holiday', 'Birthday', 'Overhead', 'PTO', 'Holiday', 'Birthday'].map((heading, i) => <th key={i} scope="col">{heading}</th>)}</tr>
        </thead>
        <tbody>{report.rows.map(row => <tr key={row.key} data-month={row.key} className={row.projected ? 'projected-row' : ''}>
          <th scope="row" className="month-column"><button type="button" className="month-edit" disabled={saving} aria-expanded={editing === row.key} aria-controls={editing === row.key ? 'month-editor' : undefined} onClick={event => editMonth(row.key, event.currentTarget)} aria-label={`Edit ${MONTH_NAMES[row.month]} ${year} leave`}><span>{MONTH_NAMES[row.month]}<small>{row.projected ? 'Projected' : row.actualHours ? 'Logged' : 'No logs'}</small></span><Edit3 size={13} /></button></th>
          <Cell value={row.weekdayHours} digits={1} /><Cell value={row.holidayCount} digits={0} /><Cell value={row.actualHours} digits={1} />
          <Cell value={row.workHours} digits={1} className={row.projected ? 'projected-value' : ''} title={row.projected ? `${fixed(row.actualHours, 1)} logged + ${fixed(row.remainingHours, 1)} projected` : 'Logged work only'} />
          <Cell value={row.rollingTotal} digits={1} title={`${row.rollingMonths}/12 tracked months`} /><Cell value={row.leaveNeeded} digits={1} />
          {showAccrued && <><Cell value={row.accruedPto} /><Cell value={row.accruedHoliday} /><Cell value={row.accruedBirthday} /></>}
          <Cell value={row.usedPto} className="used-pto" /><Cell value={row.usedHoliday} /><Cell value={row.usedBirthday} /><Cell value={row.overhead} /><Cell value={row.adjustment} />
          <Cell value={row.balance?.pto} /><Cell value={row.balance?.holiday} /><Cell value={row.balance?.birthday} />
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" className="month-column">{year} total / closing</th><Cell value={t.weekdayHours} digits={1} /><Cell value={t.holidayCount} digits={0} /><Cell value={t.actualHours} digits={1} /><Cell value={t.workHours} digits={1} /><Cell value={december.rollingTotal} digits={1} /><Cell value={t.leaveNeeded} digits={1} />
          {showAccrued && <><Cell value={t.accruedPto} /><Cell value={t.accruedHoliday} /><Cell value={t.accruedBirthday} /></>}<Cell value={t.usedPto} /><Cell value={t.usedHoliday} /><Cell value={t.usedBirthday} /><Cell value={t.overhead} /><Cell value={t.adjustment} />
          <Cell value={report.yearEndBalance?.pto} /><Cell value={report.yearEndBalance?.holiday} /><Cell value={report.yearEndBalance?.birthday} /></tr></tfoot>
      </table>
    </div>
    <details className="report-rules"><summary>Calculation details</summary>
      <p>Weekday hours include holidays, as in the reference table. Holiday credits are counted once on their observed weekday and granted at the start of the month. Birthday credit is 8 hours in January. PTO accrues at 0.0851 per worked hour.</p>
      <p>Remaining work uses {fixed(state.settings.workPercent)}% of 8 hours per non-holiday weekday, less planned leave. Future-dated daily logs replace the estimate for that day. Edit a month to change its entered leave totals and PTO adjustment.</p>
      <p>Historical PTO gaps are {state.settings.autoPto ? 'automatically filled unless an explicit PTO entry exists' : 'not automatically deducted; only explicit PTO entries reduce the PTO balance'}. Unworked observed holidays default to holiday leave; an explicit holiday entry overrides that portion of the month. Forecasts estimate PTO needed to cover future weekday gaps after other leave.</p>
      <p>Balances start at {state.settings.openingMonth}, carry across years, and may become negative. Earlier balances are unavailable. The 12-month total includes up to 12 tracked months and future estimates for projected rows.</p>
    </details>
  </div>;
};

const MonthEditor: React.FC<{ row: MonthlyRow; asOf: string; state: MonthlyReportState; onChange: Props['onChange']; onClose: () => void; onSaving: (saving: boolean) => void }> = ({ row, asOf, state, onChange, onClose, onSaving }) => {
  const firstInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(() => Object.fromEntries(LEAVE_FIELDS.map(({ category }) => {
    const total = enteredMonthTotal(state.entries, row.key, category);
    return [category, total == null ? '' : fixed(total)];
  })) as Record<LeaveCategory, string>);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { firstInput.current?.focus(); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); onSaving(true); setError('');
    try {
      const last = calendarDate(row.year, row.month + 1, 0);
      const date = row.key === asOf.slice(0, 7) ? asOf : last < asOf ? last : `${row.key}-01`;
      let entries = state.entries;
      for (const { category } of LEAVE_FIELDS) {
        const hours = values[category] === '' ? null : Number(values[category]);
        if (hours != null && (!Number.isFinite(hours) || (category !== 'adjustment' && hours < 0))) throw new Error('Enter valid hours. Only PTO adjustment can be negative.');
        entries = setEnteredMonthTotal(entries, row.key, category, hours, date, generateId());
      }
      await onChange({ ...state, entries });
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save changes.'); }
    finally { setBusy(false); onSaving(false); }
  };
  return <form id="month-editor" className="month-totals-editor" aria-labelledby="month-editor-heading" aria-describedby="month-editor-help" onSubmit={event => void save(event)} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}>
    <fieldset className="async-fields" disabled={busy}>
      <div className="table-header-row"><h3 id="month-editor-heading">{MONTH_NAMES[row.month]} {row.year}</h3><button type="button" className="btn-icon" onClick={onClose} aria-label="Close month editor"><X size={18} /></button></div>
      <div className="month-totals-fields">
        {LEAVE_FIELDS.map(({ category, label }, index) => <label key={category}>{label}<input ref={index === 0 ? firstInput : undefined} className="form-input" type="number" min={category === 'adjustment' ? undefined : 0} step="0.01" placeholder="0" value={values[category]} onChange={event => setValues({ ...values, [category]: event.target.value })} /></label>)}
      </div>
      <p id="month-editor-help" className="settings-description">Hours entered for this month, excluding automatic estimates. Blank clears the entered value; PTO and holiday then use automatic calculations. Enter 0 to explicitly record zero.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sample-actions"><button type="submit" className="btn-primary">{busy ? 'Saving…' : 'Save month'}</button><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button></div>
    </fieldset>
  </form>;
};
