import { describe, it, expect } from 'vitest';
import {
  roundToTenth,
  roundToHundredth,
  timeStringToMinutes,
  minutesToTimeString,
  calculateWorkedHours,
  calculateTargetTimeOut,
  formatDurationMinutes,
  getShiftScenarios,
  normalizeTimeInput,
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

    it('formats times as zero-padded 24-hour HH:MM', () => {
      expect(minutesToTimeString(480)).toBe('08:00');
      expect(minutesToTimeString(720)).toBe('12:00');
      expect(minutesToTimeString(990)).toBe('16:30');
      expect(minutesToTimeString(15)).toBe('00:15');
      expect(minutesToTimeString(1440)).toBe('00:00');
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
      // 08:00 + 8.0h + 30m break = 16:30
      const target = calculateTargetTimeOut('08:00', 8.0, 30);
      expect(target).not.toBeNull();
      expect(target?.timeOut24).toBe('16:30');
    });

    it('calculates target time out for 9.6 hours goal', () => {
      // 08:00 + 9.6h (576 mins) + 30m break = 18:06
      const target = calculateTargetTimeOut('08:00', 9.6, 30);
      expect(target).not.toBeNull();
      expect(target?.timeOut24).toBe('18:06');
    });

    it('formats duration strings', () => {
      expect(formatDurationMinutes(90)).toBe('1h 30m');
      expect(formatDurationMinutes(60)).toBe('1h');
      expect(formatDurationMinutes(45)).toBe('45m');
      expect(formatDurationMinutes(0)).toBe('0m');
    });
  });
});

describe('Departure scenarios', () => {
  it('pairs out time and hours independently for now, target hours, and a chosen out time', () => {
    const scenarios = getShiftScenarios('08:00', '12:00', 30, '8', '17:00');
    expect(scenarios.live).toEqual({ timeOut: '12:00', hours: 3.5 });
    expect(scenarios.shift).toEqual({ timeOut: '16:30', hours: 8 });
    expect(scenarios.out).toEqual({ timeOut: '17:00', hours: 8.5 });

    const changedOut = getShiftScenarios('08:00', '12:00', 30, '8', '14:00');
    expect(changedOut.live).toEqual(scenarios.live);
    expect(changedOut.shift).toEqual(scenarios.shift);
    expect(changedOut.out).toEqual({ timeOut: '14:00', hours: 5.5 });
  });

  it('applies the same break duration to all three scenarios', () => {
    const scenarios = getShiftScenarios('08:00', '12:00', 60, '8', '17:00');
    expect(scenarios.live?.hours).toBe(3);
    expect(scenarios.shift?.timeOut).toBe('17:00');
    expect(scenarios.out?.hours).toBe(8);
  });

  it('supports overnight scenarios and tenths of an hour', () => {
    const scenarios = getShiftScenarios('22:00', '01:00', 30, '8.5', '06:30');
    expect(scenarios.live).toEqual({ timeOut: '01:00', hours: 2.5 });
    expect(scenarios.shift).toEqual({ timeOut: '07:00', hours: 8.5 });
    expect(scenarios.out).toEqual({ timeOut: '06:30', hours: 8 });
  });

  it('leaves incomplete scenarios empty without changing the live calculation', () => {
    for (const target of ['', '0', '-1', '25', 'invalid']) {
      const scenarios = getShiftScenarios('08:00', '12:00', 30, target, '');
      expect(scenarios.live?.hours).toBe(3.5);
      expect(scenarios.shift).toBeNull();
      expect(scenarios.out).toBeNull();
    }
    expect(getShiftScenarios('', '12:00', 30, '8', '17:00'))
      .toEqual({ live: null, shift: null, out: null });
  });
});

describe('24-hour entries and tenth-hour breaks', () => {
  it('normalizes compact valid times while preserving invalid entries for correction', () => {
    for (const [typed, formatted] of [['1025', '10:25'], ['925', '09:25'], ['0000', '00:00'], ['2359', '23:59'], ['8:05', '08:05'], ['10:25', '10:25']]) {
      expect(normalizeTimeInput(typed)).toBe(formatted);
    }
    for (const typed of ['', '24:00', '2460', '2360', '25', 'abc', '8:5']) expect(normalizeTimeInput(typed)).toBe(typed);
  });
  it('rejects incomplete, out-of-range, or 12-hour time entries', () => {
    for (const value of ['1', '12:', '8:00', '08:60', '24:00', '16:30 PM', '08:00junk', '08:30:00']) {
      expect(timeStringToMinutes(value)).toBeNull();
    }
    expect(timeStringToMinutes('00:00')).toBe(0);
    expect(timeStringToMinutes('23:59')).toBe(1439);
  });

  it('uses a 36-minute break consistently for saved hours and reference scenarios', () => {
    expect(calculateWorkedHours('08:00', '17:00', 36).roundedHours).toBe(8.4);
    const scenarios = getShiftScenarios('08:00', '12:00', 36, '8', '16:00');
    expect(scenarios.live?.hours).toBe(3.4);
    expect(scenarios.shift?.timeOut).toBe('16:36');
    expect(scenarios.out?.hours).toBe(7.4);
  });
});


describe('Out Target rounds calculated hours down', () => {
  it('floors partial tenths, preserving exact tenths, breaks, and overnight shifts', () => {
    for (const [start, end, rest, expected] of [
      ['08:00', '16:35', 0, 8.5], ['08:00', '16:36', 0, 8.6],
      ['08:00', '16:05', 0, 8], ['22:00', '06:35', 30, 8],
      ['08:00', '08:05', 6, 0], ['08:00', '08:06', 0, 0.1],
    ] as const) expect(getShiftScenarios(start, end, rest, '8', end).out?.hours).toBe(expected);
    const scenarios = getShiftScenarios('08:00', '16:35', 0, '8', '16:35');
    expect(scenarios.live?.hours).toBe(8.6);
    expect(scenarios.out?.hours).toBe(8.5);
  });
});
