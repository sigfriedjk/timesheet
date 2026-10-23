import { Edit3, Trash2 } from 'lucide-react';
import { TimeLog } from '../../types';
import { formatNumber } from '../../utils/format';

interface Props {
  logs: TimeLog[];
  holidays: Record<string, string>;
  deleting: boolean;
  onEdit: (date: string) => void;
  onDelete: (date: string) => Promise<void>;
}

export function SavedEntriesTable({ logs, holidays, deleting, onEdit, onDelete }: Props) {
  return (
    <div className="table-responsive">
      <table className="logs-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Hours</th>
            <th>Holiday</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const date = new Date(`${log.date}T12:00:00`);
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <tr
                key={log.id}
                className={`${weekend ? 'weekend-row' : ''} ${holidays[log.date] ? 'holiday-row' : ''}`}
              >
                <td>{log.date}</td>
                <td>{date.toLocaleDateString('en-US', { weekday: 'short' })}</td>
                <td>
                  <span className="hours-badge">{formatNumber(log.totalHours, 1)}</span>
                </td>
                <td>
                  {holidays[log.date] ? (
                    <span className="badge badge-holiday">{holidays[log.date]}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="log-notes-cell">{log.notes || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => onEdit(log.date)}
                      aria-label={`Edit ${log.date}`}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-danger"
                      disabled={deleting}
                      onClick={() => void onDelete(log.date)}
                      aria-label={`Delete ${log.date}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
