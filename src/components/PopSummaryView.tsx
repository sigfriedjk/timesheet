import React, { useEffect, useMemo, useState } from 'react';
import { PeriodOfPerformance, TimeLog } from '../types';
import { buildPopSummary } from '../utils/popSummary';
import { useTodayDate } from '../hooks/useTodayDate';

interface Props { logs: TimeLog[]; periods: PeriodOfPerformance[] }
const fixed = (value: number | null, digits = 1) => value == null ? '—' : value.toFixed(digits);

export const PopSummaryView: React.FC<Props> = ({ logs, periods }) => {
  const years = useMemo(() => Array.from(new Set(periods.flatMap(period => Array.from({ length: Number(period.endDate.slice(0, 4)) - Number(period.startDate.slice(0, 4)) + 1 }, (_, i) => Number(period.startDate.slice(0, 4)) + i)))).sort(), [periods]);
  const asOf = useTodayDate();
  const [year, setYear] = useState('all');
  useEffect(() => { if (year !== 'all' && !years.includes(Number(year))) setYear('all'); }, [year, years]);
  const report = useMemo(() => buildPopSummary(logs, periods, asOf, year === 'all' ? undefined : Number(year)), [logs, periods, asOf, year]);
  const t = report.totals;
  return <div className="pop-view">
    <div className="monthly-toolbar">
      <label className="as-of-control">Periods overlapping<select className="form-input" aria-label="POP year" value={year} onChange={event => setYear(event.target.value)}><option value="all">All Years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    <div className="pop-stats">
      <div className="summary-stat"><span className="summary-label">Funded hours</span><strong data-stat="pop-funded">{fixed(t.targetHours)}</strong></div>
      <div className="summary-stat"><span className="summary-label">Worked hours</span><strong data-stat="pop-worked">{fixed(t.workedHours)}</strong></div>
      <div className="summary-stat"><span className="summary-label">Funded − worked</span><strong data-stat="pop-remaining" className={t.remainingHours < 0 ? 'negative-value' : ''}>{fixed(t.remainingHours)}</strong></div>
    </div>
    <div className="monthly-table-scroll pop-table-scroll" tabIndex={0} aria-label="POP summary; scroll horizontally for all columns">
      <table className="monthly-table pop-table">
        <thead><tr><th scope="col" className="month-column">POP</th><th scope="col">Date range</th><th scope="col">Weekdays</th><th scope="col">Weekday hours</th><th scope="col">Funded hours</th><th scope="col">Funded %</th><th scope="col">Worked</th><th scope="col">Funded − worked</th></tr></thead>
        <tbody>{report.rows.map(row => <tr key={row.id} data-pop={row.id} className={row.status === 'Active' ? 'active-pop' : ''}>
          <th scope="row" className="month-column"><span>{row.name}</span><small className="pop-status">{row.status}</small></th>
          <td className="pop-date-range"><time dateTime={row.startDate}>{row.startDate}</time><span> – </span><time dateTime={row.endDate}>{row.endDate}</time></td>
          <td>{row.weekdays}</td><td>{fixed(row.weekdayHours)}</td><td>{fixed(row.targetHours)}</td><td>{fixed(row.fundedPercent)}{row.fundedPercent != null && '%'}</td><td>{fixed(row.workedHours)}</td><td className={row.remainingHours < 0 ? 'negative-value' : ''}>{fixed(row.remainingHours)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" className="month-column">Total</th><td>{report.rows.length} periods</td><td>{t.weekdays}</td><td>{fixed(t.weekdayHours)}</td><td>{fixed(t.targetHours)}</td><td>{fixed(t.fundedPercent)}{t.fundedPercent != null && '%'}</td><td>{fixed(t.workedHours)}</td><td className={t.remainingHours < 0 ? 'negative-value' : ''}>{fixed(t.remainingHours)}</td></tr></tfoot>
      </table>
    </div>
    <details className="report-rules"><summary>Calculation details</summary>
      <p>Ranges include both start and end dates. The year filter includes each full POP that overlaps that year; it does not split periods at December 31. Edit POP names, dates, and funded hours in Settings.</p>
      <p>Weekday hours = Monday–Friday days × 8, including holidays. Funded % = funded hours ÷ weekday hours. Worked hours include logged work in the range, including weekends and holidays. Future logs and estimates are excluded.</p>
      <p>Funded − worked stays signed: a negative value means work exceeds funding. The total funded percentage uses total funded hours divided by total weekday hours.</p>
    </details>
  </div>;
};
