import React, { useState, useEffect } from 'react';
import { ViewTab, TimeLog } from './types';
import { getAllTimeLogs, saveTimeLog, deleteTimeLog } from './services/storage';
import { Navigation } from './components/Navigation';
import { DailyCalculator } from './components/DailyCalculator';
import { CalendarView } from './components/CalendarView';
import { MonthlySummaryView, PopSummaryView, SettingsView } from './components/OtherViews';
import { CheckCircle2, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning';
  text: string;
}

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ViewTab>('calculator');
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Load saved logs on mount
  useEffect(() => {
    setLogs(getAllTimeLogs());
  }, []);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ id: Date.now().toString(), type, text });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleLogSaved = (logData: TimeLog) => {
    const { log, isOverwrite } = saveTimeLog(
      logData.date,
      logData.totalHours,
      logData.notes
    );
    setLogs(getAllTimeLogs());

    const message = isOverwrite
      ? `Overwrote log for ${log.date}: updated to ${log.totalHours.toFixed(1)} hrs`
      : `Successfully logged ${log.totalHours.toFixed(1)} hrs for ${log.date}`;

    showToast(message, 'success');

    setCurrentTab('calendar');
  };

  const handleDeleteLog = (date: string) => {
    if (window.confirm(`Are you sure you want to delete the time log for ${date}?`)) {
      deleteTimeLog(date);
      setLogs(getAllTimeLogs());
      showToast(`Deleted entry for ${date}`, 'info');
    }
  };

  const handleEditLog = (_log: TimeLog) => {
    setCurrentTab('calculator');
  };

  return (
    <div className="app-root">
      {/* Toast Notification */}
      {toast && (
        <aside aria-label="Notification" className={`toast-notification toast-${toast.type}`}>
          <div className="toast-content">
            <CheckCircle2 size={18} />
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="toast-close"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </aside>
      )}

      {/* Navigation Header */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        loggedCount={logs.length}
      />

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-container">
          {currentTab === 'calculator' && (
            <DailyCalculator
              onLogSaved={handleLogSaved}
              existingLogs={logs}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarView
              logs={logs}
              onNavigateToCalculator={() => setCurrentTab('calculator')}
              onDeleteLog={handleDeleteLog}
              onEditLog={handleEditLog}
            />
          )}

          {currentTab === 'monthly' && <MonthlySummaryView />}

          {currentTab === 'pop' && <PopSummaryView />}

          {currentTab === 'settings' && <SettingsView />}
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <span>Work Hours Tracker &bull; Node.js + Vite + TypeScript &bull; GitHub Pages Static Architecture</span>
          <span className="footer-spec">Conforms to Design Document v1.0 (0.1hr Work / 0.01hr Leave Precision)</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
