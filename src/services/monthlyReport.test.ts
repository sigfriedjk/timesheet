import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyReportState } from '../types';
import { createDefaultMonthlyReport, normalizeMonthlyReport } from './monthlyReport';

describe('Monthly report load normalization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2032-05-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the current year for personal defaults and the explicit sample year for its fallback', () => {
    const sampleFallback = createDefaultMonthlyReport(2026);

    expect(createDefaultMonthlyReport().settings.openingMonth).toBe('2032-01');
    expect(normalizeMonthlyReport(null).settings.openingMonth).toBe('2032-01');
    expect(sampleFallback.settings.openingMonth).toBe('2026-01');
    expect(normalizeMonthlyReport(null, sampleFallback).settings.openingMonth).toBe('2026-01');
  });

  it.each([null, {}, { entries: null }, { entries: {} }, { entries: 'not an array' }])(
    'returns the full fallback for missing or invalid entries: %j',
    (saved) => {
      const fallback = createDefaultMonthlyReport(2026);
      fallback.settings.openingPto = 40;
      fallback.projectedWork = { '2026-11': 120 };
      const before = structuredClone(fallback);

      // Malformed saved JSON is intentionally outside the declared report shape.
      const normalized = normalizeMonthlyReport(saved as MonthlyReportState | null, fallback);

      expect(normalized).toEqual(before);
      expect(fallback).toEqual(before);
    },
  );

  it('fills missing settings from the supplied fallback while accepting an empty entries list', () => {
    const fallback = createDefaultMonthlyReport(2026);
    fallback.settings.openingPto = 40;

    const normalized = normalizeMonthlyReport({ entries: [] }, fallback);

    expect(normalized.settings).toEqual(fallback.settings);
    expect(normalized.entries).toEqual([]);
    expect(normalized.projectedWork).toEqual({});
  });

  it('fills only omitted settings when loading partial saved settings', () => {
    const fallback = createDefaultMonthlyReport(2026);
    fallback.settings.openingHoliday = 24;
    const saved = { settings: { openingPto: 12.5 }, entries: [] };
    const originalSaved = structuredClone(saved);
    const originalFallback = structuredClone(fallback);

    const normalized = normalizeMonthlyReport(
      saved as unknown as Partial<MonthlyReportState>,
      fallback,
    );

    expect(normalized.settings).toEqual({ ...fallback.settings, openingPto: 12.5 });
    expect(saved).toEqual(originalSaved);
    expect(fallback).toEqual(originalFallback);
  });

  it('preserves explicit zero settings instead of replacing them with nonzero fallback values', () => {
    const fallback = createDefaultMonthlyReport(2026);
    fallback.settings = {
      ptoAccrualRate: null,
      openingMonth: '2026-01',
      openingPto: 40,
      openingHoliday: 24,
      openingBirthday: 8,
      workPercent: 94.3,
    };
    const saved = {
      entries: [],
      settings: { openingPto: 0, openingHoliday: 0, openingBirthday: 0, workPercent: 0 },
    };

    const normalized = normalizeMonthlyReport(
      saved as unknown as Partial<MonthlyReportState>,
      fallback,
    );

    expect(normalized.settings).toEqual({
      ptoAccrualRate: null,
      openingMonth: '2026-01',
      openingPto: 0,
      openingHoliday: 0,
      openingBirthday: 0,
      workPercent: 0,
    });
  });

  it('retains dated entries and legacy projected work without mutating saved inputs or the fallback', () => {
    const fallback = createDefaultMonthlyReport(2026);
    const saved: MonthlyReportState = {
      ...createDefaultMonthlyReport(2031),
      ptoPolicyVersion: 0,
      entries: [{ id: 'leave', date: '2032-06-01', category: 'pto', hours: 0, notes: 'Keep this' }],
      projectedWork: { '2032-08': 0, '2033-02': 144 },
    };
    const originalSaved = structuredClone(saved);
    const originalFallback = structuredClone(fallback);

    const normalized = normalizeMonthlyReport(saved, fallback);

    expect(normalized.ptoPolicyVersion).toBe(1);
    expect(normalized.entries).toEqual(originalSaved.entries);
    expect(normalized.projectedWork).toEqual(originalSaved.projectedWork);
    expect(saved).toEqual(originalSaved);
    expect(fallback).toEqual(originalFallback);
  });
});

it('keeps personal rate configuration explicitly missing and never invents a fallback rate', () => {
  expect(createDefaultMonthlyReport().settings.ptoAccrualRate).toBeNull();
  expect(normalizeMonthlyReport({ entries: [] }).settings.ptoAccrualRate).toBeNull();
  const state = createDefaultMonthlyReport(2035);
  state.settings.ptoAccrualRate = 0;
  expect(normalizeMonthlyReport(state).settings.ptoAccrualRate).toBe(0);
  state.settings.ptoAccrualRate = 0.12345678;
  expect(normalizeMonthlyReport(state).settings.ptoAccrualRate).toBe(0.12345678);
});
