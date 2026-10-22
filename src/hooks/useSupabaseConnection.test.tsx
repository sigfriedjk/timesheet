// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '@supabase/supabase-js';
import { useSupabaseConnection } from './useSupabaseConnection';

const mocks = vi.hoisted(() => ({ clients: [] as any[], create: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mocks.create(...args) }));
const session = (id: string) => ({ user: { id } }) as Session;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  localStorage.clear(); mocks.clients = []; mocks.create.mockReset();
  mocks.create.mockImplementation(() => {
    const recovery = deferred<any>();
    let callback: (_event: string, session: Session | null) => void;
    const unsubscribe = vi.fn();
    const client = { recovery, emit: (event: string, value: Session | null) => callback(event, value), unsubscribe, auth: {
      getSession: vi.fn(() => recovery.promise),
      onAuthStateChange: vi.fn(fn => { callback = fn; return { data: { subscription: { unsubscribe } } }; }),
      startAutoRefresh: vi.fn(async () => {}), dispose: vi.fn(async () => {}),
    } };
    mocks.clients.push(client); return client;
  });
});
afterEach(cleanup);
describe('Supabase session lifecycle', () => {
  it('creates no client or auth requests in sample mode', () => {
    const { result } = renderHook(() => useSupabaseConnection(false));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result.current.client).toBeNull();
    expect(result.current.session).toBeNull();
  });
  it('recovers sessions and never overwrites a newer sign-out or account change', async () => {
    const { result } = renderHook(() => useSupabaseConnection(true));
    const client = mocks.clients[0];
    act(() => client.emit('SIGNED_IN', session('new-user')));
    expect(result.current.session?.user.id).toBe('new-user');
    await act(async () => client.recovery.resolve({ data: { session: session('old-user') }, error: null }));
    expect(result.current.session?.user.id).toBe('new-user');
    act(() => client.emit('SIGNED_OUT', null));
    expect(result.current.session).toBeNull();
    expect(result.current.authReady).toBe(true);
  });
  it('exposes recovery errors and finishes loading', async () => {
    const { result } = renderHook(() => useSupabaseConnection(true));
    await act(async () => mocks.clients[0].recovery.resolve({ data: { session: null }, error: { message: 'Session expired' } }));
    expect(result.current.authReady).toBe(true);
    expect(result.current.error).toBe('Session expired');
  });
  it('ignores old clients after sample switches and project changes', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useSupabaseConnection(enabled), { initialProps: { enabled: true } });
    const old = mocks.clients[0];
    act(() => old.emit('SIGNED_IN', session('old')));
    rerender({ enabled: false });
    expect(result.current.client).toBeNull();
    expect(old.unsubscribe).toHaveBeenCalledOnce();
    expect(old.auth.dispose).toHaveBeenCalledOnce();
    rerender({ enabled: true });
    expect(result.current.session).toBeNull();
    act(() => old.emit('SIGNED_IN', session('stale')));
    expect(result.current.session).toBeNull();
    act(() => result.current.configure({ url: 'https://other.supabase.co', publishableKey: 'sb_publishable_other' }));
    expect(result.current.session).toBeNull();
    await act(async () => mocks.clients.at(-1).recovery.resolve({ data: { session: session('other-project') }, error: null }));
    expect(result.current.session?.user.id).toBe('other-project');
  });
  it('cleans up StrictMode subscriptions and ignores first-mount recovery', async () => {
    const { result, unmount } = renderHook(() => useSupabaseConnection(true), { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> });
    expect(mocks.clients).toHaveLength(2);
    expect(mocks.clients[0].unsubscribe).toHaveBeenCalledOnce();
    await act(async () => mocks.clients[0].recovery.resolve({ data: { session: session('stale') }, error: null }));
    expect(result.current.session).toBeNull();
    act(() => mocks.clients[1].emit('INITIAL_SESSION', session('current')));
    await waitFor(() => expect(result.current.session?.user.id).toBe('current'));
    unmount();
    expect(mocks.clients[1].unsubscribe).toHaveBeenCalledOnce();
  });
});
