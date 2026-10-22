// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTodayDate } from './useTodayDate';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 23, 59, 59)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('current local report date', () => {
  it('advances at local midnight while the report stays open', () => {
    const { result } = renderHook(useTodayDate);
    expect(result.current).toBe('2026-10-22');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe('2026-10-23');
  });
  it('refreshes after sleep on focus or visibility changes and cleans up its timer', () => {
    const { result, unmount } = renderHook(useTodayDate);
    act(() => { vi.setSystemTime(new Date(2026, 9, 24, 12)); window.dispatchEvent(new Event('focus')); });
    expect(result.current).toBe('2026-10-24');
    act(() => { vi.setSystemTime(new Date(2026, 9, 25, 12)); document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current).toBe('2026-10-25');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
