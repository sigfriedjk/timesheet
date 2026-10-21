/**
 * Calculation utilities implementing the formulas from Section 6 of design_document.md
 */

/**
 * ROUND_0.1(x) = ROUND(x * 10) / 10
 * Mandatory precision rule for all work hours.
 */
export function roundToTenth(value: number): number {
  if (isNaN(value)) return 0;
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * ROUND_0.01(x) = ROUND(x * 100) / 100
 * Mandatory precision rule for all leave balances and accruals.
 */
export function roundToHundredth(value: number): number {
  if (isNaN(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Parses a "HH:MM" string into minutes from midnight (0 - 1439).
 */
export function timeStringToMinutes(timeStr: string): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Formats total minutes from midnight into a 24-hour "HH:MM" string.
 */
export function minutesToTimeString(minutesFromMidnight: number): string {
  const normalized = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Formats a 24-hour "HH:MM" string or minutes into a user-friendly 12-hour string (e.g. "4:30 PM").
 */
export function formatTime12Hour(timeStrOrMinutes: string | number): string {
  const totalMinutes =
    typeof timeStrOrMinutes === 'number'
      ? timeStrOrMinutes
      : timeStringToMinutes(timeStrOrMinutes);

  if (totalMinutes === null || isNaN(totalMinutes)) return '--:--';

  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const mm = minutes.toString().padStart(2, '0');
  return `${hours}:${mm} ${ampm}`;
}

/**
 * Calculates raw hours and 0.1-rounded total hours from Time In, Time Out, and Break Duration.
 * Formula 6.1: Raw Hours = ((TimeOut - TimeIn) - BreakMinutes) / 60
 * Handles overnight shifts automatically if timeOut < timeIn.
 */
export function calculateWorkedHours(
  timeIn: string,
  timeOut: string,
  breakMinutes: number = 0
): { rawHours: number; roundedHours: number } {
  const inMin = timeStringToMinutes(timeIn);
  const outMin = timeStringToMinutes(timeOut);

  if (inMin === null || outMin === null) {
    return { rawHours: 0, roundedHours: 0 };
  }

  let spanMinutes = outMin - inMin;
  if (spanMinutes < 0) {
    // Spans across midnight
    spanMinutes += 1440;
  }

  const effectiveMinutes = Math.max(0, spanMinutes - Math.max(0, breakMinutes));
  const rawHours = effectiveMinutes / 60;
  const roundedHours = roundToTenth(rawHours);

  return { rawHours, roundedHours };
}

/**
 * Computes Target Time Out for a given target shift hours.
 * Formula 6.1: Target Time Out = TimeIn + H_target + BreakMinutes
 */
export function calculateTargetTimeOut(
  timeIn: string,
  targetHours: number,
  breakMinutes: number = 0
): { timeOut24: string; timeOut12: string; totalTargetMinutesFromMidnight: number } | null {
  const inMin = timeStringToMinutes(timeIn);
  if (inMin === null || isNaN(targetHours) || targetHours <= 0) {
    return null;
  }

  const workMinutes = Math.round(targetHours * 60);
  const totalShiftMinutes = workMinutes + Math.max(0, breakMinutes);
  const targetMinutesFromMidnight = inMin + totalShiftMinutes;

  const timeOut24 = minutesToTimeString(targetMinutesFromMidnight);
  const timeOut12 = formatTime12Hour(targetMinutesFromMidnight);

  return {
    timeOut24,
    timeOut12,
    totalTargetMinutesFromMidnight: targetMinutesFromMidnight,
  };
}

/**
 * Helper to get current local date in YYYY-MM-DD
 */
export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to get current local time in HH:MM (24-hour)
 */
export function getCurrentTimeString(d: Date = new Date()): string {
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Converts minutes to friendly "Xh Ym" or "Ym" string
 */
export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/** Computes the out-time/hours pair for each departure scenario independently. */
export function getShiftScenarios(
  timeIn: string,
  currentTime: string,
  breakMinutes: number,
  targetHoursInput: string,
  targetOut: string
) {
  const validStart = timeStringToMinutes(timeIn) !== null;
  const hoursAt = (timeOut: string) =>
    validStart && timeStringToMinutes(timeOut) !== null
      ? { timeOut, hours: calculateWorkedHours(timeIn, timeOut, breakMinutes).roundedHours }
      : null;
  const hours = Number(targetHoursInput);
  const shift = Number.isFinite(hours) && hours >= 0.1 && hours <= 24
    ? calculateTargetTimeOut(timeIn, hours, breakMinutes)
    : null;

  return {
    live: hoursAt(currentTime),
    shift: shift ? { timeOut: shift.timeOut24, hours } : null,
    out: hoursAt(targetOut),
  };
}
