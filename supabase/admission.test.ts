import { describe, expect, it, vi } from 'vitest';
import { configureSingleOwnerAuth } from '../scripts/supabase-admission.mjs';

function management(accounts = 1, establishedAccounts = 1, initial = {}) {
  let auth = { disable_signup: false, external_anonymous_users_enabled: false, external_email_enabled: true,
    site_url: 'https://fictional.example.invalid/', rate_limit_email_sent: 2, ...initial };
  const request = vi.fn(async (path: string, method = 'GET', body?: any) => {
    if (path === 'database/query') return [{ accounts, established_accounts: establishedAccounts }];
    if (path === 'config/auth' && method === 'PATCH') auth = { ...auth, ...body };
    return { ...auth };
  });
  return { request, auth: () => auth };
}

describe('Single-owner Supabase admission policy', () => {
  it('disables both registration routes, reads them back, and preserves sign-in and unrelated settings', async () => {
    const server = management(1, 1, { external_anonymous_users_enabled: true });
    await configureSingleOwnerAuth(server.request);
    expect(server.request).toHaveBeenCalledWith('config/auth', 'PATCH', {
      disable_signup: true, external_anonymous_users_enabled: false,
    });
    expect(server.request.mock.calls.at(-1)).toEqual(['config/auth']);
    expect(server.auth()).toEqual({ disable_signup: true, external_anonymous_users_enabled: false,
      external_email_enabled: true, site_url: 'https://fictional.example.invalid/', rate_limit_email_sent: 2 });
    expect(server.request.mock.calls.filter(call => call[0] === 'database/query')).toHaveLength(1);
    expect(server.request.mock.calls[0][2].query.trim()).toMatch(/^select /);
  });

  it.each([[0, 0], [1, 0], [2, 1], [2, 2]])('refuses ambiguous or unestablished owners (%i accounts, %i established)', async (accounts, established) => {
    const server = management(accounts, established);
    await expect(configureSingleOwnerAuth(server.request)).rejects.toThrow('exactly one');
    expect(server.request.mock.calls).toHaveLength(1);
  });

  it('requires the existing email sign-in route before making changes', async () => {
    const server = management(1, 1, { external_email_enabled: false });
    await expect(configureSingleOwnerAuth(server.request)).rejects.toThrow('Email sign-in');
    expect(server.request.mock.calls.some(call => call[1] === 'PATCH')).toBe(false);
  });

  it('is repeatable without writing an already locked configuration', async () => {
    const server = management(1, 1, { disable_signup: true });
    await configureSingleOwnerAuth(server.request);
    expect(server.request.mock.calls.some(call => call[1] === 'PATCH')).toBe(false);
  });

  it('fails if the server does not retain the lock', async () => {
    const server = management();
    const request = vi.fn(async (path: string, method?: string, body?: any) => {
      if (method === 'PATCH') return {}; // Simulate a successful response without persisted settings.
      return server.request(path, method, body);
    });
    await expect(configureSingleOwnerAuth(request)).rejects.toThrow('readback failed');
  });

  it('propagates permission failures rather than reporting a successful lock', async () => {
    const server = management();
    const request = vi.fn(async (path: string, method?: string, body?: any) => {
      if (method === 'PATCH') throw new Error('HTTP 403');
      return server.request(path, method, body);
    });
    await expect(configureSingleOwnerAuth(request)).rejects.toThrow('HTTP 403');
  });
});
