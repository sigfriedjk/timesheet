import { BarChart3, Layers, Settings } from 'lucide-react';

export const MonthlySummaryView: React.FC = () => {
  return (
    <div className="placeholder-view">
      <div className="view-header">
        <div>
          <h2>Monthly Summary & Leave Tracking</h2>
        </div>
      </div>

      <div className="calculator-card">
        <div className="feature-preview-box">
          <BarChart3 size={40} className="feature-icon" />
          <h3>Interface 3 Foundation Ready</h3>
          <p>
            This module will calculate formulaic monthly aggregations based on saved <code>TimeLog</code> records:
          </p>
          <ul className="formula-preview-list">
            <li>
              <strong>Total Worked Hours:</strong> <code>H_month = ROUND_0.1(SUM(totalHours))</code>
            </li>
            <li>
              <strong>Accrued Worked Leave:</strong> <code>A_worked = ROUND_0.01(0.0851 * H_month)</code>
            </li>
            <li>
              <strong>Holiday & Birthday Accrual:</strong> 8.0 hrs per federal holiday + 8.0 hrs on Jan 1st.
            </li>
            <li>
              <strong>Net Ending Leave Balance:</strong> Running monthly balance to nearest 0.01 hour.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

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

export const SettingsView: React.FC = () => {
  return (
    <div className="placeholder-view">
      <div className="view-header">
        <div>
          <h2>POP & System Settings</h2>
        </div>
      </div>

      <div className="calculator-card">
        <div className="feature-preview-box">
          <Settings size={40} className="feature-icon" />
          <h3>Interface 5 Foundation Ready</h3>
          <p>
            Allows configuring Periods of Performance and recording manual leave balance adjustments with reason codes.
          </p>
        </div>
      </div>
    </div>
  );
};
