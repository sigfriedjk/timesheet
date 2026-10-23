import { LeaveSettings, MonthlyReportState } from '../types';

/** Defaults and normalization shared by cloud loads and local sample storage. */
export function createDefaultMonthlyReport(year = new Date().getFullYear()): MonthlyReportState {
  return {
    ptoPolicyVersion: 1,
    settings: {
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
