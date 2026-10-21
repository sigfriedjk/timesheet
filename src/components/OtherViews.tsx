import { Layers } from 'lucide-react';

export const PopSummaryView: React.FC = () => {
  return (
    <div className="placeholder-view">
      <div className="view-header">
        <div>
          <h2>Period of Performance (POP) Summary</h2>
        </div>
      </div>

      <div className="calculator-card">
        <div className="feature-preview-box">
          <Layers size={40} className="feature-icon" />
          <h3>Interface 4 Foundation Ready</h3>
          <p>
            Dynamically aggregates logged hours grouped by user-defined billing and contract periods:
          </p>
          <ul className="formula-preview-list">
            <li>
              <strong>Logged Hours:</strong> <code>ROUND_0.1(SUM(totalHours within POP range))</code>
            </li>
            <li>
              <strong>Remaining Hours:</strong> <code>Target Hours - Logged Hours</code>
            </li>
            <li>
              <strong>Completion %:</strong> <code>(Logged Hours / Target Hours) * 100%</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
