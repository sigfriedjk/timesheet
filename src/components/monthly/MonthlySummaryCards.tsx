import React from 'react';
import { LeaveBalance, MonthlyRow, MonthlySummary } from '../../utils/monthlySummary';
import { MONTH_NAMES } from '../../utils/calendar';
import { formatNumber as fixed } from '../../utils/format';

const BalanceDetail: React.FC<{ value: LeaveBalance | null; rateConfigured: boolean }> = ({
  value,
  rateConfigured,
}) =>
  value ? (
    <dl className="leave-breakdown">
      {(['pto', 'holiday', 'birthday'] as const).map((category) => (
        <div key={category}>
          <dt>{category === 'pto' ? 'PTO' : category === 'holiday' ? 'Holiday' : 'Birthday'}</dt>
          <dd
            data-stat={`leave-${category}`}
            className={value[category] < 0 ? 'negative-value' : ''}
          >
            {fixed(value[category])}
            <small> h</small>
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <span>
      {rateConfigured
        ? 'Set an opening month and balances in Settings.'
        : 'Set a PTO accrual rate in Settings to calculate balances.'}
    </span>
  );

export function MonthlySummaryCards({ report }: { report: MonthlySummary }) {
  const current = report.currentMonth;
  const previous = report.previousMonth;
  const monthLabel = (row: MonthlyRow) => `${MONTH_NAMES[row.month]} ${row.year}`;
  return (
    <div className="monthly-stats">
      <section className="summary-stat" aria-label="End-of-month balance">
        <h3 className="summary-label">End-of-month balance</h3>
        <span className="summary-period">{monthLabel(previous)}</span>
        <BalanceDetail value={previous.actualBalance} rateConfigured={report.rateConfigured} />
      </section>
      <section className="summary-stat" aria-label="Current month">
        <h3 className="summary-label">Current month</h3>
        <span className="summary-period">{monthLabel(current)}</span>
        <dl className="current-month-breakdown">
          {[
            { label: 'Weekday hours', value: current.weekdayHours, stat: 'month-weekday-hours' },
            { label: 'Holidays', value: current.holidayCount, stat: 'month-holidays', count: true },
            { label: 'Forecast work total', value: current.workHours, stat: 'month-work-hours' },
            { label: '12-month total', value: current.rollingTotal, stat: 'month-rolling-hours' },
            { label: 'Leave needed', value: current.leaveNeeded, stat: 'month-leave-needed' },
          ].map(({ label, value, stat, count }) => (
            <div key={stat}>
              <dt>{label}</dt>
              <dd data-stat={stat}>
                {fixed(value, count ? 0 : 1)}
                {!count && <small> h</small>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
