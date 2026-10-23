import { PeriodOfPerformance } from '../types';
import { createDefaultMonthlyReport } from '../services/monthlyReport';

// Fictional demonstration data. Never used as a personal-account fallback.
export const SAMPLE_PERIODS: readonly PeriodOfPerformance[] = [
  {
    id: 'fictional-aurora',
    name: 'Fictional Aurora',
    startDate: '2026-01-12',
    endDate: '2026-05-08',
    targetHours: 111.2,
  },
  {
    id: 'fictional-comet',
    name: 'Fictional Comet',
    startDate: '2026-07-13',
    endDate: '2026-12-18',
    targetHours: 222.7,
  },
  {
    id: 'fictional-orbit',
    name: 'Fictional Orbit',
    startDate: '2027-02-09',
    endDate: '2027-05-14',
    targetHours: 33.6,
  },
];

export const samplePeriods = (): PeriodOfPerformance[] =>
  SAMPLE_PERIODS.map((period) => ({ ...period }));

export function createSampleMonthlyReport() {
  const report = createDefaultMonthlyReport(2026);
  report.settings.ptoAccrualRate = 0.04; // Fictional PTO hours per worked hour.
  return report;
}
