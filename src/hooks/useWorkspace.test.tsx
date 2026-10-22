// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { useWorkspace, getLegacyReport } from './useWorkspace';
import { createDefaultMonthlyReport } from '../utils/monthlySummary';
import { clearStorageForTesting, getAllTimeLogs, saveTimeLog } from '../services/storage';
import { LogDataset } from '../services/storage';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../services/supabaseRepository', async original => ({ ...await original<any>(), createSupabaseRepository: mocks.create }));
const client = {} as SupabaseClient;
const log = (date: string) => ({ id: date, date, totalHours: 8, notes: 'cloud', createdAt: '', updatedAt: '' });
const data = (date = '2026-10-01') => ({ logs: [log(date)], report: createDefaultMonthlyReport() });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function repository() { return { load: vi.fn(async () => data()), saveLog: vi.fn(async () => log('2026-10-02')), deleteLog: vi.fn(async () => {}), saveReport: vi.fn(async state => state), importBrowserData: vi.fn(async () => 1) }; }
function hook(userId: string | undefined = 'a') { return renderHook(({ userId, dataset }) => useWorkspace(dataset, client, userId), { initialProps: { userId: userId as string | undefined, dataset: 'personal' as LogDataset } }); }
beforeEach(() => { clearStorageForTesting(); mocks.create.mockReset(); });
afterEach(cleanup);
describe('Workspace persistence and isolation', () => {
  it('gates personal views until auth and both cloud resources load', async () => {
    const repo = repository(); const load = deferred<ReturnType<typeof data>>(); repo.load.mockReturnValue(load.promise); mocks.create.mockReturnValue(repo);
    const { result, rerender } = renderHook(({ userId }) => useWorkspace('personal', client, userId), { initialProps: { userId: undefined as string | undefined } });
    expect(result.current.ready).toBe(false);
    expect(result.current.logs).toEqual([]);
    rerender({ userId: 'a' });
    expect(result.current.ready).toBe(false);
    await act(async () => load.resolve(data()));
    expect(result.current.ready).toBe(true);
    expect(result.current.logs).toHaveLength(1);
  });
  it('keeps sample data entirely local and rejects browser import', async () => {
    saveTimeLog('2026-10-21', 9, 'personal original');
    const { result } = renderHook(() => useWorkspace('sample2026', client, 'a'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.logs).toHaveLength(149);
    await act(async () => { await result.current.saveLog('2026-10-21', 4); });
    await act(async () => { await expect(result.current.importBrowser()).rejects.toThrow('Sign in'); });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(getAllTimeLogs()).toHaveLength(1);
    expect(getAllTimeLogs()[0].notes).toBe('personal original');
  });
  it('clears old user data immediately and ignores late loads across account switches', async () => {
    const first = deferred<ReturnType<typeof data>>(); const a = repository(); a.load.mockReturnValue(first.promise);
    const b = repository(); b.load.mockResolvedValue(data('2026-10-20'));
    mocks.create.mockImplementation((_client, id) => id === 'a' ? a : b);
    const { result, rerender } = hook();
    rerender({ userId: 'b', dataset: 'personal' });
    await waitFor(() => expect(result.current.logs[0]?.date).toBe('2026-10-20'));
    await act(async () => first.resolve(data('2026-01-01')));
    expect(result.current.logs[0].date).toBe('2026-10-20');
    rerender({ userId: undefined, dataset: 'personal' });
    expect(result.current.ready).toBe(false);
    expect(result.current.logs).toEqual([]);
  });
  it('rejects duplicate writes, uses the latest snapshot, and keeps failed saves out of UI/local storage', async () => {
    const repo = repository(); mocks.create.mockReturnValue(repo);
    const { result } = hook();
    await waitFor(() => expect(result.current.ready).toBe(true));
    const saved = deferred<ReturnType<typeof log>>(); repo.saveLog.mockReturnValueOnce(saved.promise);
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.saveLog('2026-10-02', 8); });
    await act(async () => { await expect(result.current.deleteLog('2026-10-01')).rejects.toThrow('Wait'); });
    expect(result.current.logs).toHaveLength(1);
    await act(async () => { saved.resolve(log('2026-10-02')); await pending; });
    await act(async () => { await result.current.deleteLog('2026-10-01'); });
    expect(result.current.logs.map(item => item.date)).toEqual(['2026-10-02']);
    repo.saveLog.mockRejectedValueOnce(new Error('Offline'));
    await act(async () => { await expect(result.current.saveLog('2026-10-03', 9)).rejects.toThrow('Offline'); });
    expect(result.current.logs).toHaveLength(1);
    expect(getAllTimeLogs()).toEqual([]);
  });
  it('rejects late save success after source changes, including a return to the same sample source', async () => {
    const repo = repository(); mocks.create.mockReturnValue(repo);
    const saved = deferred<ReturnType<typeof log>>(); repo.saveLog.mockReturnValueOnce(saved.promise);
    const { result, rerender } = hook();
    await waitFor(() => expect(result.current.ready).toBe(true));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.saveLog('2026-10-02', 8); });
    const rejected = expect(pending).rejects.toThrow('account or data source changed');
    rerender({ userId: 'a', dataset: 'sample2026' });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { saved.resolve(log('2026-10-02')); await rejected; });
    expect(result.current.logs).toHaveLength(149);
    expect(result.current.logs.some(item => item.notes === 'cloud')).toBe(false);
  });
  it('supports load retries and persists reports and explicit personal browser imports', async () => {
    const repo = repository(); repo.load.mockRejectedValueOnce(new Error('Schema missing')); mocks.create.mockReturnValue(repo);
    const { result } = hook();
    await waitFor(() => expect(result.current.error).toBe('Schema missing'));
    expect(result.current.ready).toBe(false);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const report = createDefaultMonthlyReport(); report.settings.autoPto = false;
    await act(async () => { await result.current.saveReport(report); });
    expect(result.current.report.settings.autoPto).toBe(false);
    saveTimeLog('2026-09-01', 7);
    const original = JSON.stringify({ ...report, ptoPolicyVersion: 0 });
    localStorage.setItem('work_hours_tracker_personal_monthly_report', original);
    expect(getLegacyReport()?.settings.autoPto).toBe(true);
    await act(async () => { expect(await result.current.importBrowser()).toBe(1); });
    expect(repo.importBrowserData).toHaveBeenCalledWith(getAllTimeLogs(), getLegacyReport());
    expect(localStorage.getItem('work_hours_tracker_personal_monthly_report')).toBe(original);
  });
});
