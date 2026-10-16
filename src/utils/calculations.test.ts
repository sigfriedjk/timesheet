import { describe, it, expect } from 'vitest';
import {
  roundToTenth,
  roundToHundredth,
  timeStringToMinutes,
  minutesToTimeString,
  formatTime12Hour,
  calculateWorkedHours,
  calculateTargetTimeOut,
  formatDurationMinutes,
} from './calculations';

describe('Calculations & Precision Rules (Section 6)', () => {
  describe('Rounding Precision Rules', () => {
    it('rounds work hours to nearest 0.1 hour', () => {
      expect(roundToTenth(8.04)).toBe(8.0);
      expect(roundToTenth(8.05)).toBe(8.1);
      expect(roundToTenth(9.56)).toBe(9.6);
      expect(roundToTenth(7.25)).toBe(7.3);
      expect(roundToTenth(0.0)).toBe(0.0);
    });

    it('rounds leave accruals and balances to nearest 0.01 hour', () => {
      expect(roundToHundredth(8.514)).toBe(8.51);
      expect(roundToHundredth(8.515)).toBe(8.52);
      expect(roundToHundredth(0.0851 * 80)).toBe(6.81);
      expect(roundToHundredth(0.0851 * 160)).toBe(13.62);
    });
  });

  describe('Time Parsing & Formatting', () => {
    it('converts HH:MM strings to minutes from midnight', () => {
      expect(timeStringToMinutes('00:00')).toBe(0);
      expect(timeStringToMinutes('08:30')).toBe(510);
      expect(timeStringToMinutes('12:00')).toBe(720);
      expect(timeStringToMinutes('23:59')).toBe(1439);
      expect(timeStringToMinutes('invalid')).toBeNull();
    });

    it('converts minutes back to 24h and 12h formats', () => {
      expect(minutesToTimeString(480)).toBe('08:00');
      expect(formatTime12Hour('08:00')).toBe('8:00 AM');
      expect(formatTime12Hour('12:00')).toBe('12:00 PM');
      expect(formatTime12Hour('16:30')).toBe('4:30 PM');
      expect(formatTime12Hour('00:15')).toBe('12:15 AM');
    });
  });

  describe('Worked Hours Calculation', () => {
    it('calculates 8.0 hours correctly with 30 min break', () => {
      // 08:00 to 16:30 is 8.5 hours span - 0.5 break = 8.0 hours
      const result = calculateWorkedHours('08:00', '16:30', 30);
      expect(result.rawHours).toBe(8.0);
      expect(result.roundedHours).toBe(8.0);
    });

    it('calculates 9.6 hours correctly with 0 min break', () => {
      // 08:00 to 17:36 is 9 hours 36 mins = 9.6 hours
      const result = calculateWorkedHours('08:00', '17:36', 0);
      expect(result.rawHours).toBe(9.6);
      expect(result.roundedHours).toBe(9.6);
    });

    it('handles rounding to nearest 0.1 for partial hours', () => {
      // 09:00 to 17:00 with 45 min break = 8h - 45m = 7h 15m = 7.25h -> 7.3h
      const result = calculateWorkedHours('09:00', '17:00', 45);
      expect(result.rawHours).toBe(7.25);
      expect(result.roundedHours).toBe(7.3);
    });

    it('handles overnight shift spanning midnight', () => {
      // 22:00 to 06:30 with 30m break: 8.5h span - 0.5h break = 8.0h
      const result = calculateWorkedHours('22:00', '06:30', 30);
      expect(result.rawHours).toBe(8.0);
      expect(result.roundedHours).toBe(8.0);
    });
  });

  describe('Target Time Out Calculation', () => {
    it('calculates target time out for 8.0 hours goal', () => {
      // 08:00 + 8.0h + 30m break = 16:30 (4:30 PM)
      const target = calculateTargetTimeOut('08:00', 8.0, 30);
      expect(target).not.toBeNull();
      expect(target?.timeOut24).toBe('16:30');
      expect(target?.timeOut12).toBe('4:30 PM');
    });

    it('calculates target time out for 9.6 hours goal', () => {
      // 08:00 + 9.6h (576 mins) + 30m break = 606 mins -> 18:06 (6:06 PM)
      const target = calculateTargetTimeOut('08:00', 9.6, 30);
      expect(target).not.toBeNull();
      expect(target?.timeOut24).toBe('18:06');
      expect(target?.timeOut12).toBe('6:06 PM');
    });

    it('formats duration strings', () => {
      expect(formatDurationMinutes(90)).toBe('1h 30m');
      expect(formatDurationMinutes(60)).toBe('1h');
      expect(formatDurationMinutes(45)).toBe('45m');
      expect(formatDurationMinutes(0)).toBe('0m');
    });
  });
});
