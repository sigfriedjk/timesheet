import { describe, expect, it } from 'vitest';
import { validateSupabaseConfig } from './supabaseConfig';
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
const jwt = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`;
describe('Browser Supabase credentials', () => {
  it('accepts only public modern or legacy anon credentials', () => {
    expect(validateSupabaseConfig(config)).toEqual(config);
    expect(validateSupabaseConfig({ ...config, publishableKey: jwt('anon') }).publishableKey).toBe(jwt('anon'));
    for (const publishableKey of ['sb_secret_test', jwt('service_role'), 'not-a-key']) {
      expect(() => validateSupabaseConfig({ ...config, publishableKey })).toThrow('publishable key');
    }
  });
  it('rejects non-HTTPS, REST paths and embedded credentials', () => {
    for (const url of ['http://example.com', config.url + '/rest/v1/', 'https://user:password@example.com', config.url + '?key=bad']) {
      expect(() => validateSupabaseConfig({ ...config, url })).toThrow();
    }
  });
});
