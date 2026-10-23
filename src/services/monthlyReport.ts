import { LeaveSettings, MonthlyReportState } from '../types';
import { isPtoAccrualRate } from '../utils/ptoAccrualRate';

/** Defaults and normalization shared by cloud loads and local sample storage. */
export function createDefaultMonthlyReport(year = new Date().getFullYear()): MonthlyReportState {
  return {
    ptoPolicyVersion: 1,
    settings: {
      ptoAccrualRate: null,
      openingMonth: `${year}-01`,
      openingPto: 0,
      openingHoliday: 0,
      openingBirthday: 0,
      workPercent: 94.3,
    },
    entries: [],
    projectedWork: {},
  };
}

export function normalizeLeaveSettings(
  settings: Partial<LeaveSettings> | undefined,
  defaults: LeaveSettings,
): LeaveSettings {
  return {
    ptoAccrualRate:
      settings?.ptoAccrualRate === undefined
        ? (defaults.ptoAccrualRate ?? null)
        : isPtoAccrualRate(settings.ptoAccrualRate)
          ? settings.ptoAccrualRate
          : null,
    openingMonth: settings?.openingMonth ?? defaults.openingMonth,
    openingPto: settings?.openingPto ?? defaults.openingPto,
    openingHoliday: settings?.openingHoliday ?? defaults.openingHoliday,
    openingBirthday: settings?.openingBirthday ?? defaults.openingBirthday,
    workPercent: settings?.workPercent ?? defaults.workPercent,
  };
}

export function normalizeMonthlyReport(
  parsed: Partial<MonthlyReportState> | null,
  fallback = createDefaultMonthlyReport(),
): MonthlyReportState {
  if (!parsed || !Array.isArray(parsed.entries)) return fallback;

  return {
    ptoPolicyVersion: 1,
    settings: normalizeLeaveSettings(parsed.settings, fallback.settings),
    entries: parsed.entries,
    projectedWork: parsed.projectedWork ?? {},
  };
}
