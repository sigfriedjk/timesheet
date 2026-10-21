import React, { useState, useEffect } from 'react';
import { ViewTab, TimeLog } from './types';
import { getActiveLogDataset, setActiveLogDataset, LogDataset } from './services/storage';
import { useSupabaseConnection } from './hooks/useSupabaseConnection';
import { useWorkspace } from './hooks/useWorkspace';
import { SupabaseAccess } from './components/SupabaseSettings';
import { Navigation } from './components/Navigation';
import { DailyCalculator } from './components/DailyCalculator';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { PopSummaryView } from './components/PopSummaryView';
import { MonthlySummaryView } from './components/MonthlySummaryView';
import { CheckCircle2, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning';
  text: string;
}

export const App: React.FC = () => {
  const [dataset, setDataset] = useState<LogDataset>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sample') === '2026'
      ? 'sample2026' : getActiveLogDataset()
  );
  const connection = useSupabaseConnection(dataset === 'personal');
  const workspace = useWorkspace(dataset, connection.client, connection.session?.user.id);
  const { logs, report: reportState } = workspace;
  const viewIdentity = `${dataset}:${connection.config?.url}:${connection.session?.user.id ?? ''}`;
  const [currentTab, setCurrentTab] = useState<ViewTab>(() => {
    const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null;
    return view && ['calculator', 'calendar', 'monthly', 'pop', 'settings'].includes(view)
      ? view as ViewTab : dataset === 'sample2026' ? 'calendar' : 'calculator';
  });
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => { setActiveLogDataset(dataset); }, [dataset]);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ id: Date.now().toString(), type, text });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleLogSaved = async (logData: TimeLog) => {
    const isOverwrite = logs.some(log => log.date === logData.date);
    const log = await workspace.saveLog(logData.date, logData.totalHours, logData.notes);
    showToast(`${isOverwrite ? 'Updated' : 'Logged'} ${log.totalHours.toFixed(1)} hrs for ${log.date}`);
    setCurrentTab('calendar');
  };

  const handleDeleteLog = async (date: string) => {
    if (window.confirm(`Are you sure you want to delete the time log for ${date}?`)) {
      await workspace.deleteLog(date);
      showToast(`Deleted entry for ${date}`, 'info');
    }
  };

  const handleCalendarSave = async (date: string, hours: number, notes: string) => {
    await workspace.saveLog(date, hours, notes);
    showToast(`Saved ${hours.toFixed(1)} hrs for ${date}`);
  };

  const useSampleData = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('sample', '2026');
    window.history.replaceState(null, '', url);
    setDataset('sample2026');
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
        <div className="content-container" key={viewIdentity}>
          {currentTab !== 'settings' && !workspace.ready && <SupabaseAccess connection={connection} workspace={workspace} onOpenSettings={() => setCurrentTab('settings')} />}
          {workspace.ready && currentTab === 'calculator' && (
            <DailyCalculator
              onLogSaved={handleLogSaved}
              existingLogs={logs}
            />
          )}

          {workspace.ready && currentTab === 'calendar' && (
            <CalendarView
              key={dataset}
              logs={logs}
              isSample={dataset === 'sample2026'}
              onNavigateToCalculator={() => setCurrentTab('calculator')}
              onDeleteLog={handleDeleteLog}
              onSaveLog={handleCalendarSave}
            />
          )}

          {workspace.ready && currentTab === 'monthly' && <MonthlySummaryView key={dataset} logs={logs} state={reportState} isSample={dataset === 'sample2026'} onChange={workspace.saveReport} onOpenSettings={() => setCurrentTab('settings')} />}

          {workspace.ready && currentTab === 'pop' && <PopSummaryView key={dataset} logs={logs} isSample={dataset === 'sample2026'} onOpenSettings={() => setCurrentTab('settings')} />}

          {currentTab === 'settings' && (
            <SettingsView
              isSample={dataset === 'sample2026'}
              leaveSettings={reportState.settings}
              onSaveLeaveSettings={async settings => { await workspace.saveReport({ ...reportState, settings }); }}
              onUseSample={useSampleData}
              onUsePersonal={usePersonalData}
              onResetSample={workspace.resetSample}
              connection={connection}
              workspace={workspace}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      {currentTab !== 'calendar' && currentTab !== 'monthly' && currentTab !== 'pop' && <footer className="app-footer">
        <div className="footer-container">
          <span>Work Hours Tracker &bull; Node.js + Vite + TypeScript &bull; GitHub Pages Static Architecture</span>
          <span className="footer-spec">Conforms to Design Document v1.0 (0.1hr Work / 0.01hr Leave Precision)</span>
        </div>
      </footer>}
    </div>
  );
};

export default App;
