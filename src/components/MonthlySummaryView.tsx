import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit3, X, Trash2 } from 'lucide-react';
import { LeaveBalance, MonthlyRow, buildMonthlySummary } from '../utils/monthlySummary';
import { LeaveCategory, MonthlyReportState, TimeLog } from '../types';
import { MONTH_NAMES, calendarDate } from '../utils/calendar';
import { getTodayDateString } from '../utils/calculations';
import { generateId } from '../services/storage';
import { SAMPLE_END } from '../services/sampleData';

interface Props {
  logs: TimeLog[];
  state: MonthlyReportState;
  isSample: boolean;
  onChange: (state: MonthlyReportState) => void;
  onOpenSettings: () => void;
}
const fixed = (value: number | null | undefined, digits = 2) => value == null ? '—' : value.toFixed(digits);
const BalanceDetail: React.FC<{ value: LeaveBalance | null }> = ({ value }) => value
  ? <span>PTO {fixed(value.pto)} · Holiday {fixed(value.holiday)} · Birthday {fixed(value.birthday)}</span>
  : <span>Set an opening month and balances in Settings.</span>;
const Cell: React.FC<{ value: number | null | undefined; digits?: number; className?: string; title?: string }> = ({ value, digits = 2, className = '', title }) =>
  <td className={`${className} ${value != null && value < 0 ? 'negative-value' : ''}`} title={title}>{fixed(value, digits)}</td>;

export const MonthlySummaryView: React.FC<Props> = ({ logs, state, isSample, onChange, onOpenSettings }) => {
  const [asOf, setAsOf] = useState(isSample ? SAMPLE_END : getTodayDateString());
  const [year, setYear] = useState(Number(asOf.slice(0, 4)));
  const [editing, setEditing] = useState<string | null>(null);
  const report = useMemo(() => buildMonthlySummary(logs, state, year, asOf), [logs, state, year, asOf]);
  const t = report.totals;
  const december = report.rows[11];
  const projectedYear = `${year}-12-31` > asOf;
  const balanceDate = asOf > `${year}-12-31` ? `${year}-12-31` : asOf;
  return <div className="monthly-view">
    <div className="monthly-toolbar">
      <div className="year-selector" aria-label="Summary year">
        <button type="button" className="btn-icon" aria-label="Previous summary year" onClick={() => setYear(year - 1)}>←</button>
        <strong>{year}</strong>
        <button type="button" className="btn-icon" aria-label="Next summary year" onClick={() => setYear(year + 1)}>→</button>
      </div>
      <label className="as-of-control">Actuals through<input type="date" className="form-input" value={asOf} onChange={event => { if (event.target.value) setAsOf(event.target.value); }} /></label>
      <button type="button" className="btn-secondary" onClick={onOpenSettings}>Leave & forecast settings</button>
    </div>
    <div className="monthly-stats">
      <div className="summary-stat"><span className="summary-label">Logged year hours</span><strong data-stat="year-hours">{fixed(t.actualHours, 1)}</strong><span>Forecast year total: {fixed(t.workHours, 1)} h</span></div>
      <div className="summary-stat"><span className="summary-label">Trailing 12-month average</span><strong data-stat="rolling-average">{fixed(report.rolling.average, 1)} <small>h/month</small></strong><span>{report.rolling.months}/12 completed months · {fixed(report.rolling.total, 1)} h total</span><span>{report.rolling.start} – {report.rolling.end}</span></div>
      <div className="summary-stat"><span className="summary-label">Leave through {balanceDate}</span><strong data-stat="current-leave" className={(report.currentBalance?.total ?? 0) < 0 ? 'negative-value' : ''}>{fixed(report.currentBalance?.total)} <small>h</small></strong><BalanceDetail value={report.currentBalance} /></div>
      <div className="summary-stat"><span className="summary-label">{projectedYear ? 'Projected December leave' : 'December leave'}</span><strong data-stat="year-end-leave" className={(report.yearEndBalance?.total ?? 0) < 0 ? 'negative-value' : ''}>{fixed(report.yearEndBalance?.total)} <small>h</small></strong><BalanceDetail value={report.yearEndBalance} /></div>
    </div>
    <div className="monthly-table-scroll" tabIndex={0} aria-label="Monthly work and leave summary; scroll horizontally for all columns">
      <table className="monthly-table">
        <thead>
          <tr><th rowSpan={2} className="month-column" scope="col">Month</th><th colSpan={7} scope="colgroup">Work & trailing 12 months</th><th colSpan={3} scope="colgroup" className="accrual-group">Accrued</th><th colSpan={4} scope="colgroup" className="usage-group">Used / planned leave</th><th rowSpan={2} scope="col">PTO adj.</th><th colSpan={4} scope="colgroup" className="balance-group">End-of-month balances</th></tr>
          <tr>{['Weekday h', 'Holidays', 'Logged h', 'Work total', '12m avg', '12m total', 'Leave needed', 'PTO', 'Holiday', 'Birthday', 'PTO', 'Holiday', 'Birthday', 'Overhead', 'PTO', 'Holiday', 'Birthday', 'Total'].map((heading, i) => <th key={i} scope="col" className={i === 17 ? 'balance-total' : ''}>{heading}</th>)}</tr>
        </thead>
        <tbody>{report.rows.map(row => <tr key={row.key} data-month={row.key} className={row.projected ? 'projected-row' : ''}>
          <th scope="row" className="month-column"><button type="button" className="month-edit" onClick={() => setEditing(row.key)} aria-label={`Edit ${MONTH_NAMES[row.month]} ${year} leave and projection`}><span>{MONTH_NAMES[row.month]}<small>{row.projected ? 'Projected' : row.actualHours ? 'Logged' : 'No logs'}</small></span><Edit3 size={13} /></button></th>
          <Cell value={row.weekdayHours} digits={1} /><Cell value={row.holidayCount} digits={0} /><Cell value={row.actualHours} digits={1} />
          <Cell value={row.workHours} digits={1} className={row.projected ? 'projected-value' : ''} title={row.projected ? `${fixed(row.actualHours, 1)} logged + ${fixed(row.remainingHours, 1)} projected` : 'Logged work only'} />
          <td className="rolling-cell" title={`Average over ${row.rollingMonths}/12 tracked months; includes forecasts for projected rows.`}>{fixed(row.rollingMonths ? row.rollingAverage : null, 1)}{row.rollingMonths < 12 && <small>{row.rollingMonths}/12</small>}</td>
          <Cell value={row.rollingTotal} digits={1} title={`${row.rollingMonths}/12 tracked months`} /><Cell value={row.leaveNeeded} digits={1} />
          <Cell value={row.accruedPto} /><Cell value={row.accruedHoliday} /><Cell value={row.accruedBirthday} />
          <Cell value={row.usedPto} /><Cell value={row.usedHoliday} /><Cell value={row.usedBirthday} /><Cell value={row.overhead} /><Cell value={row.adjustment} />
          <Cell value={row.balance?.pto} /><Cell value={row.balance?.holiday} /><Cell value={row.balance?.birthday} /><Cell value={row.balance?.total} className="balance-total" />
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" className="month-column">{year} total / closing</th><Cell value={t.weekdayHours} digits={1} /><Cell value={t.holidayCount} digits={0} /><Cell value={t.actualHours} digits={1} /><Cell value={t.workHours} digits={1} /><Cell value={december.rollingAverage} digits={1} /><Cell value={december.rollingTotal} digits={1} /><Cell value={t.leaveNeeded} digits={1} />
          <Cell value={t.accruedPto} /><Cell value={t.accruedHoliday} /><Cell value={t.accruedBirthday} /><Cell value={t.usedPto} /><Cell value={t.usedHoliday} /><Cell value={t.usedBirthday} /><Cell value={t.overhead} /><Cell value={t.adjustment} />
          <Cell value={report.yearEndBalance?.pto} /><Cell value={report.yearEndBalance?.holiday} /><Cell value={report.yearEndBalance?.birthday} /><Cell value={report.yearEndBalance?.total} className="balance-total" /></tr></tfoot>
      </table>
    </div>
    <details className="report-rules"><summary>Calculation details</summary>
      <p>Weekday hours include holidays, as in the reference table. Holiday credits are counted once on their observed weekday and granted at the start of the month. Birthday credit is 8 hours in the month selected in Settings. PTO accrues at 0.0851 per worked hour.</p>
      <p>Logged hours stop at the selected cutoff. Remaining work uses {state.settings.workPercent.toFixed(1)}% of 8 hours per non-holiday weekday, less planned leave. Future-dated daily logs replace the estimate for that day. Edit a month to override its projected work total or add dated leave and adjustments.</p>
      <p>Historical PTO gaps are {state.settings.autoPto ? 'automatically filled unless an explicit PTO entry exists' : 'not automatically deducted; only explicit PTO entries reduce the PTO balance'}. Unworked observed holidays default to holiday leave; an explicit holiday entry overrides that portion of the month. Forecasts estimate PTO needed to cover future weekday gaps after other leave.</p>
      <p>Balances start at {state.settings.openingMonth}, carry across years, and may become negative. Earlier balances are unavailable. Rolling averages use up to 12 tracked months; missing history before tracking began is excluded, while empty tracked months count as zero. The top average uses completed months; projected rows include future estimates.</p>
    </details>
    {editing && <MonthEditor key={editing} row={report.rows.find(row => row.key === editing)!} asOf={asOf} state={state} onChange={onChange} onClose={() => setEditing(null)} />}
  </div>;
};

const CATEGORY_NAMES: Record<LeaveCategory, string> = { pto: 'PTO', holiday: 'Holiday', birthday: 'Birthday', overhead: 'Overhead', adjustment: 'PTO adjustment' };
const MonthEditor: React.FC<{ row: MonthlyRow; asOf: string; state: MonthlyReportState; onChange: Props['onChange']; onClose: () => void }> = ({ row, asOf, state, onChange, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [work, setWork] = useState(state.projectedWork[row.key]?.toFixed(1) ?? '');
  const last = calendarDate(row.year, row.month + 1, 0);
  const [date, setDate] = useState(row.key === asOf.slice(0, 7) ? asOf : last < asOf ? last : `${row.key}-01`);
  const [category, setCategory] = useState<LeaveCategory>('pto');
  const [hours, setHours] = useState('8.00');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const entries = state.entries.filter(entry => entry.date.startsWith(`${row.key}-`)).sort((a, b) => a.date.localeCompare(b.date));
  useEffect(() => { ref.current?.showModal(); }, []);
  const automatic = () => {
    const projectedWork = { ...state.projectedWork };
    delete projectedWork[row.key];
    onChange({ ...state, projectedWork }); setWork(''); setStatus('Automatic forecast restored.');
  };
  return <dialog ref={ref} className="month-editor day-editor" aria-labelledby="month-editor-heading" onClose={onClose}>
    <div className="table-header-row"><h3 id="month-editor-heading">{MONTH_NAMES[row.month]} {row.year}</h3><button type="button" className="btn-icon" onClick={() => ref.current?.close()} aria-label="Close month editor"><X size={18} /></button></div>
    {row.projected && <form className="month-projection-form" onSubmit={event => {
      event.preventDefault();
      if (work === '') { automatic(); return; }
      onChange({ ...state, projectedWork: { ...state.projectedWork, [row.key]: Number(work) } });
      setStatus('Monthly work projection saved.');
    }}>
      <label className="form-label" htmlFor="monthly-work-total">Projected total work hours</label>
      <input id="monthly-work-total" className="form-input" type="number" min={row.actualHours} max={Number(last.slice(-2)) * 24} step="0.1" value={work} placeholder={fixed(row.workHours, 1)} onChange={event => setWork(event.target.value)} />
      <p className="settings-description">Includes {fixed(row.actualHours, 1)} already logged hours. Blank uses the automatic work forecast.</p>
      <div className="sample-actions"><button type="submit" className="btn-primary">Save projection</button><button type="button" className="btn-secondary" onClick={automatic}>Use automatic forecast</button></div>
    </form>}
    <h4>Add leave or adjustment</h4>
    <form className="leave-entry-form" onSubmit={event => {
      event.preventDefault();
      onChange({ ...state, entries: [...state.entries, { id: generateId(), date, category, hours: Number(hours), notes: notes.trim() || undefined }] });
      setNotes(''); setStatus(`${CATEGORY_NAMES[category]} entry saved.`);
    }}>
      <div className="report-settings-grid">
        <label>Date<input className="form-input" type="date" value={date} min={`${row.key}-01`} max={last} onChange={event => setDate(event.target.value)} required /></label>
        <label>Type<select className="form-input" value={category} onChange={event => setCategory(event.target.value as LeaveCategory)}>{Object.entries(CATEGORY_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Hours<input className="form-input" type="number" min={category === 'adjustment' ? undefined : 0} step="0.01" value={hours} onChange={event => setHours(event.target.value)} required /></label>
        <label>Note<input className="form-input" type="text" value={notes} onChange={event => setNotes(event.target.value)} /></label>
      </div>
      <p className="settings-description">Dates after {asOf} are planned leave. A zero PTO entry overrides automatic historical PTO; zero holiday entries override automatic holiday usage.</p>
      <button type="submit" className="btn-primary">Add entry</button>
    </form>
    <p className="settings-status" role="status">{status}</p>
    {entries.length > 0 && <ul className="leave-entry-list" aria-label="Month leave entries">{entries.map(entry => <li key={entry.id}><div><strong>{entry.date} · {CATEGORY_NAMES[entry.category]} · {fixed(entry.hours)} h</strong><small>{entry.date > asOf ? 'Planned' : 'Entered'}{entry.notes ? ` · ${entry.notes}` : ''}</small></div><button type="button" className="btn-icon btn-danger" aria-label={`Delete ${entry.date} ${CATEGORY_NAMES[entry.category]} entry`} onClick={() => onChange({ ...state, entries: state.entries.filter(item => item.id !== entry.id) })}><Trash2 size={16} /></button></li>)}</ul>}
    <button type="button" className="btn-secondary" onClick={() => ref.current?.close()}>Done</button>
  </dialog>;
};
