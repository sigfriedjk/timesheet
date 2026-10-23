import React, { useMemo, useRef } from 'react';
import { PeriodOfPerformance, TimeLog } from '../types';
import { buildPopSummary, currentPopCards, PopCard } from '../utils/popSummary';
import { useTodayDate } from '../hooks/useTodayDate';
import { formatNumber } from '../utils/format';

interface Props { logs: TimeLog[]; periods: PeriodOfPerformance[] }
const fixed = (value: number | null, digits = 1) => formatNumber(value, digits);

export const PopSummaryView: React.FC<Props> = ({ logs, periods }) => {
  const asOf = useTodayDate();
  const currentPop = useRef<HTMLTableRowElement>(null);
  const report = useMemo(() => buildPopSummary(logs, periods, asOf), [logs, periods, asOf]);
  const t = report.totals;
  const cards = useMemo(() => currentPopCards(report.rows, asOf), [report.rows, asOf]);
  return <div className="pop-view">
    <div className="pop-stats pop-summary-cards">
      <PopSummaryCard title="POP Year" period={`${cards.year.startDate} – ${cards.year.endDate}`} card={cards.year} name="year" />
      {cards.current ? <PopSummaryCard title="POP" period={`${cards.current.name} · ${cards.current.startDate} – ${cards.current.endDate}`} card={cards.current} name="current" />
        : <section className="summary-stat" aria-label="POP"><h3 className="summary-label">POP</h3><p>No POP includes today.</p></section>}
    </div>
    <div className="monthly-toolbar"><button type="button" className="btn-secondary" disabled={!cards.current} onClick={() => currentPop.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Jump to today</button></div>
    <div className="monthly-table-scroll pop-table-scroll" tabIndex={0} aria-label="POP summary; scroll horizontally for all columns">
      <table className="monthly-table pop-table">
        <thead><tr><th scope="col" className="month-column">POP</th><th scope="col">Date range</th><th scope="col">Weekdays</th><th scope="col">Weekday hours</th><th scope="col">Funded hours</th><th scope="col">Funded %</th><th scope="col">Worked</th><th scope="col">Available</th></tr></thead>
        <tbody>{report.rows.map(row => <tr key={row.id} ref={row.status === 'Active' ? currentPop : undefined} data-pop={row.id} aria-current={row.status === 'Active' ? 'date' : undefined} className={row.status === 'Active' ? 'active-pop current-month-row' : row.status === 'Upcoming' ? 'future-month-row' : ''}>
          <th scope="row" className="month-column"><span>{row.name}</span><small className="pop-status">{row.status}</small></th>
          <td className="pop-date-range"><time dateTime={row.startDate}>{row.startDate}</time><span> – </span><time dateTime={row.endDate}>{row.endDate}</time></td>
          <td>{row.weekdays}</td><td>{fixed(row.weekdayHours)}</td><td>{fixed(row.targetHours)}</td><td>{fixed(row.fundedPercent)}{row.fundedPercent != null && '%'}</td><td>{fixed(row.workedHours)}</td><td className={row.remainingHours < 0 ? 'negative-value' : ''}>{fixed(row.remainingHours)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" className="month-column">Total</th><td>{report.rows.length} periods</td><td>{t.weekdays}</td><td>{fixed(t.weekdayHours)}</td><td>{fixed(t.targetHours)}</td><td>{fixed(t.fundedPercent)}{t.fundedPercent != null && '%'}</td><td>{fixed(t.workedHours)}</td><td className={t.remainingHours < 0 ? 'negative-value' : ''}>{fixed(t.remainingHours)}</td></tr></tfoot>
      </table>
    </div>
  </div>;
};

const PopSummaryCard: React.FC<{ title: string; period: string; card: PopCard; name: string }> = ({ title, period, card, name }) => <section className="summary-stat pop-summary-card" aria-label={title}>
  <h3 className="summary-label">{title}</h3><span className="summary-period">{period}</span>
  <dl className="current-month-breakdown pop-card-breakdown">
    {([{ field: 'funded', label: 'Funded' }, { field: 'worked', label: 'Worked' }, { field: 'available', label: 'Available' }] as const).map(({ field, label }) => <div key={field}>
      <dt>{label}</dt><dd data-stat={`pop-${name}-${field}`} className={card[field] < 0 ? 'negative-value' : ''}>{fixed(card[field])}<small> h</small></dd>
    </div>)}
  </dl>
</section>;
