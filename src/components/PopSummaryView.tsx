import React, { useMemo } from 'react';
import { PeriodOfPerformance, TimeLog } from '../types';
import { buildPopSummary } from '../utils/popSummary';
import { useTodayDate } from '../hooks/useTodayDate';
import { formatNumber } from '../utils/format';

interface Props { logs: TimeLog[]; periods: PeriodOfPerformance[] }
const fixed = (value: number | null, digits = 1) => formatNumber(value, digits);

export const PopSummaryView: React.FC<Props> = ({ logs, periods }) => {
  const asOf = useTodayDate();
  const report = useMemo(() => buildPopSummary(logs, periods, asOf), [logs, periods, asOf]);
  const t = report.totals;
  return <div className="pop-view">
    <div className="pop-stats">
      <div className="summary-stat"><span className="summary-label">Funded hours</span><strong data-stat="pop-funded">{fixed(t.targetHours)}</strong></div>
      <div className="summary-stat"><span className="summary-label">Worked hours</span><strong data-stat="pop-worked">{fixed(t.workedHours)}</strong></div>
      <div className="summary-stat"><span className="summary-label">Funded − worked</span><strong data-stat="pop-remaining" className={t.remainingHours < 0 ? 'negative-value' : ''}>{fixed(t.remainingHours)}</strong></div>
    </div>
    <div className="monthly-table-scroll pop-table-scroll" tabIndex={0} aria-label="POP summary; scroll horizontally for all columns">
      <table className="monthly-table pop-table">
        <thead><tr><th scope="col" className="month-column">POP</th><th scope="col">Date range</th><th scope="col">Weekdays</th><th scope="col">Weekday hours</th><th scope="col">Funded hours</th><th scope="col">Funded %</th><th scope="col">Worked</th><th scope="col">Funded − worked</th></tr></thead>
        <tbody>{report.rows.map(row => <tr key={row.id} data-pop={row.id} aria-current={row.status === 'Active' ? 'date' : undefined} className={row.status === 'Active' ? 'active-pop current-month-row' : row.status === 'Upcoming' ? 'future-month-row' : ''}>
          <th scope="row" className="month-column"><span>{row.name}</span><small className="pop-status">{row.status}</small></th>
          <td className="pop-date-range"><time dateTime={row.startDate}>{row.startDate}</time><span> – </span><time dateTime={row.endDate}>{row.endDate}</time></td>
          <td>{row.weekdays}</td><td>{fixed(row.weekdayHours)}</td><td>{fixed(row.targetHours)}</td><td>{fixed(row.fundedPercent)}{row.fundedPercent != null && '%'}</td><td>{fixed(row.workedHours)}</td><td className={row.remainingHours < 0 ? 'negative-value' : ''}>{fixed(row.remainingHours)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" className="month-column">Total</th><td>{report.rows.length} periods</td><td>{t.weekdays}</td><td>{fixed(t.weekdayHours)}</td><td>{fixed(t.targetHours)}</td><td>{fixed(t.fundedPercent)}{t.fundedPercent != null && '%'}</td><td>{fixed(t.workedHours)}</td><td className={t.remainingHours < 0 ? 'negative-value' : ''}>{fixed(t.remainingHours)}</td></tr></tfoot>
      </table>
    </div>
  </div>;
};
