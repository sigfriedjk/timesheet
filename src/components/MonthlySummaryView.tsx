import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Edit3 } from 'lucide-react';
import { buildMonthlySummary, getMonthlySummaryRange } from '../utils/monthlySummary';
import { MonthlyReportState, TimeLog } from '../types';
import { MONTH_NAMES } from '../utils/calendar';
import { useTodayDate } from '../hooks/useTodayDate';
import { MonthEditor } from './monthly/MonthEditor';
import { MonthlySummaryCards } from './monthly/MonthlySummaryCards';
import { formatNumber as fixed } from '../utils/format';

interface Props {
  logs: TimeLog[];
  state: MonthlyReportState;
  onChange: (state: MonthlyReportState) => Promise<void>;
}
const Cell: React.FC<{
  value: number | null | undefined;
  digits?: number;
  className?: string;
  title?: string;
}> = ({ value, digits = 2, className = '', title }) => (
  <td
    className={`${className} ${value != null && value < 0 ? 'negative-value' : ''}`}
    title={title}
  >
    {fixed(value, digits)}
  </td>
);

export const MonthlySummaryView: React.FC<Props> = ({ logs, state, onChange }) => {
  const asOf = useTodayDate();
  const currentMonth = useRef<HTMLTableRowElement>(null);
  const [jumpRequest, setJumpRequest] = useState(0);
  const [year, setYear] = useState('all');
  useEffect(() => {
    if (jumpRequest) currentMonth.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [year, jumpRequest]);
  const range = useMemo(() => getMonthlySummaryRange(logs, state, asOf), [logs, state, asOf]);
  useEffect(() => {
    if (year !== 'all' && !range.years.includes(Number(year))) {
      setYear('all');
      setEditing(null);
    }
  }, [year, range]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAccrued, setShowAccrued] = useState(false);
  const [saving, setSaving] = useState(false);
  const editButton = useRef<HTMLButtonElement | null>(null);
  const closeEditor = () => {
    setEditing(null);
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const editMonth = (key: string, button: HTMLButtonElement) => {
    editButton.current = button;
    setEditing(key);
  };
  const report = useMemo(
    () => buildMonthlySummary(logs, state, year === 'all' ? 'all' : Number(year), asOf),
    [logs, state, year, asOf],
  );
  const totals = report.totals;
  const closing = report.rows[report.rows.length - 1];
  return (
    <div className="monthly-view">
      <MonthlySummaryCards report={report} />
      <div className="monthly-toolbar">
        <button
          type="button"
          className="btn-secondary"
          disabled={saving}
          onClick={() => {
            setYear(asOf.slice(0, 4));
            setEditing(null);
            setJumpRequest((value) => value + 1);
          }}
        >
          Jump to today
        </button>
        <button
          type="button"
          className="btn-secondary accrual-toggle"
          aria-expanded={showAccrued}
          aria-controls="monthly-summary-table"
          onClick={() => setShowAccrued(!showAccrued)}
        >
          {showAccrued ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {showAccrued ? 'Hide accrued' : 'Show accrued'}
        </button>
      </div>
      {editing && (
        <MonthEditor
          key={editing}
          row={report.rows.find((row) => row.key === editing)!}
          asOf={asOf}
          state={state}
          onChange={onChange}
          onClose={closeEditor}
          onSaving={setSaving}
        />
      )}
      <div
        className="monthly-table-scroll"
        tabIndex={0}
        aria-label="Monthly work and leave summary; scroll horizontally for all columns"
      >
        <table className="monthly-table" id="monthly-summary-table">
          <thead>
            <tr>
              <th rowSpan={2} className="month-column" scope="col">
                <span>Month</span>
                <label className="as-of-control">
                  <select
                    className="form-input"
                    aria-label="Monthly summary year"
                    value={year}
                    disabled={saving}
                    onChange={(event) => {
                      setYear(event.target.value);
                      setEditing(null);
                    }}
                  >
                    <option value="all">All Years</option>
                    {range.years.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              <th colSpan={6} scope="colgroup">
                Work & trailing 12 months
              </th>
              {showAccrued && (
                <th colSpan={3} scope="colgroup" className="accrual-group">
                  Accrued
                </th>
              )}
              <th colSpan={4} scope="colgroup" className="usage-group">
                Used / planned leave
              </th>
              <th rowSpan={2} scope="col">
                PTO adj.
              </th>
              <th colSpan={3} scope="colgroup" className="balance-group">
                End-of-month balances
              </th>
            </tr>
            <tr>
              {[
                'Weekday h',
                'Holidays',
                'Logged h',
                'Work total',
                '12m total',
                'Leave needed',
                ...(showAccrued ? ['PTO', 'Holiday', 'Birthday'] : []),
                'PTO',
                'Holiday',
                'Birthday',
                'Overhead',
                'PTO',
                'Holiday',
                'Birthday',
              ].map((heading, i) => (
                <th key={i} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.key}
                ref={row.key === asOf.slice(0, 7) ? currentMonth : undefined}
                data-month={row.key}
                aria-current={row.key === asOf.slice(0, 7) ? 'date' : undefined}
                className={`${row.projected ? 'projected-row ' : ''}${row.key === asOf.slice(0, 7) ? 'current-month-row' : row.key > asOf.slice(0, 7) ? 'future-month-row' : ''}`}
              >
                <th scope="row" className="month-column">
                  <button
                    type="button"
                    className="month-edit"
                    disabled={saving}
                    aria-expanded={editing === row.key}
                    aria-controls={editing === row.key ? 'month-editor' : undefined}
                    onClick={(event) => editMonth(row.key, event.currentTarget)}
                    aria-label={`Edit ${MONTH_NAMES[row.month]} ${row.year} leave`}
                  >
                    <span>
                      {MONTH_NAMES[row.month].slice(0, 3)} {row.year}
                      <small>
                        {row.key === asOf.slice(0, 7)
                          ? 'Current month'
                          : row.key > asOf.slice(0, 7)
                            ? 'Forecast'
                            : row.actualHours
                              ? 'Logged'
                              : 'No logs'}
                      </small>
                    </span>
                    <Edit3 size={13} />
                  </button>
                </th>
                <Cell value={row.weekdayHours} digits={1} />
                <Cell value={row.holidayCount} digits={0} />
                <Cell value={row.actualHours} digits={1} />
                <Cell
                  value={row.workHours}
                  digits={1}
                  className={row.projected ? 'projected-value' : ''}
                  title={
                    row.projected
                      ? `${fixed(row.actualHours, 1)} logged + ${fixed(row.remainingHours, 1)} projected`
                      : 'Logged work only'
                  }
                />
                <Cell
                  value={row.rollingTotal}
                  digits={1}
                  title={`${row.rollingMonths}/12 tracked months`}
                />
                <Cell value={row.leaveNeeded} digits={1} />
                {showAccrued && (
                  <>
                    <Cell value={row.accruedPto} />
                    <Cell value={row.accruedHoliday} />
                    <Cell value={row.accruedBirthday} />
                  </>
                )}
                <Cell value={row.usedPto} className="used-pto" />
                <Cell value={row.usedHoliday} />
                <Cell value={row.usedBirthday} />
                <Cell value={row.overhead} />
                <Cell value={row.adjustment} />
                <Cell value={row.balance?.pto} />
                <Cell value={row.balance?.holiday} />
                <Cell value={row.balance?.birthday} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="month-column">
                {year === 'all' ? 'Total / closing' : `${year} total / closing`}
              </th>
              <Cell value={totals.weekdayHours} digits={1} />
              <Cell value={totals.holidayCount} digits={0} />
              <Cell value={totals.actualHours} digits={1} />
              <Cell value={totals.workHours} digits={1} />
              <Cell value={closing.rollingTotal} digits={1} />
              <Cell value={totals.leaveNeeded} digits={1} />
              {showAccrued && (
                <>
                  <Cell value={totals.accruedPto} />
                  <Cell value={totals.accruedHoliday} />
                  <Cell value={totals.accruedBirthday} />
                </>
              )}
              <Cell value={totals.usedPto} />
              <Cell value={totals.usedHoliday} />
              <Cell value={totals.usedBirthday} />
              <Cell value={totals.overhead} />
              <Cell value={totals.adjustment} />
              <Cell value={report.yearEndBalance?.pto} />
              <Cell value={report.yearEndBalance?.holiday} />
              <Cell value={report.yearEndBalance?.birthday} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
