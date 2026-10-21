import React, { useState, useEffect } from 'react';
import { ViewTab, TimeLog, MonthlyReportState } from './types';
import { getAllTimeLogs, saveTimeLog, deleteTimeLog, getActiveLogDataset, setActiveLogDataset, initializeSampleLogs, LogDataset, getMonthlyReportState, saveMonthlyReportState } from './services/storage';
import { Navigation } from './components/Navigation';
import { DailyCalculator } from './components/DailyCalculator';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { PopSummaryView } from './components/OtherViews';
import { MonthlySummaryView } from './components/MonthlySummaryView';
import { CheckCircle2, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning';
  text: string;
}

export const App: React.FC = () => {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [dataset, setDataset] = useState<LogDataset>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sample') === '2026'
      ? 'sample2026' : getActiveLogDataset()
  );
  const [reportState, setReportState] = useState<MonthlyReportState>(() => getMonthlyReportState(dataset));
  const [currentTab, setCurrentTab] = useState<ViewTab>(() => {
    const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null;
    return view && ['calculator', 'calendar', 'monthly', 'pop', 'settings'].includes(view)
      ? view as ViewTab : dataset === 'sample2026' ? 'calendar' : 'calculator';
  });
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    setLogs(dataset === 'sample2026' ? initializeSampleLogs() : getAllTimeLogs());
    setActiveLogDataset(dataset);
    setReportState(getMonthlyReportState(dataset));
  }, [dataset]);

  const updateReportState = (state: MonthlyReportState) => {
    saveMonthlyReportState(state, dataset);
    setReportState(state);
  };

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
      logData.notes,
      dataset
    );
    setLogs(getAllTimeLogs(dataset));

    const message = isOverwrite
      ? `Overwrote log for ${log.date}: updated to ${log.totalHours.toFixed(1)} hrs`
      : `Successfully logged ${log.totalHours.toFixed(1)} hrs for ${log.date}`;

    showToast(message, 'success');

    setCurrentTab('calendar');
  };

  const handleDeleteLog = (date: string) => {
    if (window.confirm(`Are you sure you want to delete the time log for ${date}?`)) {
      deleteTimeLog(date, dataset);
      setLogs(getAllTimeLogs(dataset));
      showToast(`Deleted entry for ${date}`, 'info');
    }
  };

  const handleCalendarSave = (date: string, hours: number, notes: string) => {
    saveTimeLog(date, hours, notes, dataset);
    setLogs(getAllTimeLogs(dataset));
    showToast(`Saved ${hours.toFixed(1)} hrs for ${date}`);
  };

  const usePersonalData = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('sample');
    window.history.replaceState(null, '', url);
    setDataset('personal');
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
              key={dataset}
              logs={logs}
              isSample={dataset === 'sample2026'}
              onNavigateToCalculator={() => setCurrentTab('calculator')}
              onDeleteLog={handleDeleteLog}
              onSaveLog={handleCalendarSave}
            />
          )}

          {currentTab === 'monthly' && <MonthlySummaryView key={dataset} logs={logs} state={reportState} isSample={dataset === 'sample2026'} onChange={updateReportState} onOpenSettings={() => setCurrentTab('settings')} />}

          {currentTab === 'pop' && <PopSummaryView />}

          {currentTab === 'settings' && (
            <SettingsView
              isSample={dataset === 'sample2026'}
              leaveSettings={reportState.settings}
              onSaveLeaveSettings={settings => updateReportState({ ...reportState, settings })}
              onUseSample={() => setDataset('sample2026')}
              onUsePersonal={usePersonalData}
              onResetSample={() => { const restored = initializeSampleLogs(true); setLogs(restored); setReportState(getMonthlyReportState(dataset)); return restored.length; }}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      {currentTab !== 'calendar' && currentTab !== 'monthly' && <footer className="app-footer">
        <div className="footer-container">
          <span>Work Hours Tracker &bull; Node.js + Vite + TypeScript &bull; GitHub Pages Static Architecture</span>
          <span className="footer-spec">Conforms to Design Document v1.0 (0.1hr Work / 0.01hr Leave Precision)</span>
        </div>
      </footer>}
    </div>
  );
};

export default App;
