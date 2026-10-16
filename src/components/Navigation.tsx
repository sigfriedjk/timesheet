import React from 'react';
import { ViewTab } from '../types';
import { Clock, Calendar, BarChart3, Layers, Settings } from 'lucide-react';

interface NavigationProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  loggedCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  loggedCount,
}) => {
  const navItems: { id: ViewTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'calculator',
      label: 'Daily Calculator',
      icon: <Clock size={18} />,
    },
    {
      id: 'calendar',
      label: '12-Month Calendar',
      icon: <Calendar size={18} />,
      badge: loggedCount > 0 ? loggedCount : undefined,
    },
    {
      id: 'monthly',
      label: 'Monthly Summary',
      icon: <BarChart3 size={18} />,
    },
    {
      id: 'pop',
      label: 'POP Summary',
      icon: <Layers size={18} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={18} />,
    },
  ];

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand">
          <div className="brand-icon">
            <Clock size={22} />
          </div>
          <div className="brand-text">
            <h1>Work Hours Tracker</h1>
            <span className="brand-subtitle">GitHub Pages + Jamstack</span>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                type="button"
              >
                <span className="tab-icon">{item.icon}</span>
                <span className="tab-label">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="tab-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
