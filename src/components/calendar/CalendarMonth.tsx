import React from 'react';
import { TimeLog } from '../../types';
import { MONTH_NAMES, WEEKDAY_NAMES, getMonthCells, getMonthSummary } from '../../utils/calendar';
import { formatNumber } from '../../utils/format';

interface Props {
  year: number;
  month: number;
  today: string;
  logs: TimeLog[];
  logsByDate: Map<string, TimeLog>;
  elementRef?: React.Ref<HTMLElement>;
  onSelectDate: (date: string) => void;
}

export function CalendarMonth({
  year,
  month,
  today,
  logs,
  logsByDate,
  elementRef,
  onSelectDate,
}: Props) {
  const monthName = MONTH_NAMES[month];
  const summary = getMonthSummary(logs, year, month);
  return (
    <section
      ref={elementRef}
      className="month-calendar calculator-card"
      aria-label={`${monthName} ${year}`}
    >
      <div className="month-heading">
        <h3>{monthName}</h3>
        <span>{formatNumber(summary.hours, 1)} h</span>
      </div>
      <div className="month-weekdays" aria-hidden="true">
        {WEEKDAY_NAMES.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="month-days">
        {getMonthCells(year, month).map((day, index) => {
          if (!day)
            return <span className="calendar-padding" key={`blank-${index}`} aria-hidden="true" />;
          const log = logsByDate.get(day.date);
          const label = `${monthName} ${day.day}, ${year}: ${log ? `${formatNumber(log.totalHours, 1)} hours` : 'no entry'}${day.holiday ? `; ${day.holiday}` : ''}`;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={`calendar-day${day.isWeekend ? ' calendar-weekend' : ''}${day.holiday ? ' calendar-holiday' : ''}${log ? ' calendar-logged' : ''}${day.date === today ? ' calendar-today' : ''}`}
              aria-current={day.date === today ? 'date' : undefined}
              aria-label={label}
              title={`${label}${log?.notes ? `; ${log.notes}` : ''}`}
            >
              <span className="calendar-date">
                {day.day}
                {day.holiday && (
                  <span className="holiday-marker" aria-hidden="true">
                    •
                  </span>
                )}
              </span>
              <span className="calendar-hours">{log ? formatNumber(log.totalHours, 1) : '—'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
