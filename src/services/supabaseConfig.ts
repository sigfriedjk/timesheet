import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL } from '../config/supabasePublic';

export interface SupabaseConfig { url: string; publishableKey: string }
const CONFIG_KEY = 'work_hours_tracker_supabase_config';

/** Public client credentials only; privileged keys must never enter the browser. */
export function validateSupabaseConfig(input: SupabaseConfig): SupabaseConfig {
  const url = new URL(input.url.trim());
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use the HTTPS project URL, without a path or credentials.');
  }
  const publishableKey = input.publishableKey.trim();
  let anon = false;
  try { anon = JSON.parse(atob(publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { /* Modern keys are not JWTs. */ }
  if (!publishableKey.startsWith('sb_publishable_') && !anon) throw new Error('Use a publishable key or legacy anon key. Secret and service-role keys cannot be used in this app.');
  return { url: url.origin, publishableKey };
}

export function getSupabaseConfig(): SupabaseConfig | null {
  try {
    const stored = window.localStorage.getItem(CONFIG_KEY);
    if (stored) return validateSupabaseConfig(JSON.parse(stored));
  } catch { /* Build-time defaults still work if storage is unavailable. */ }
  const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  try { return validateSupabaseConfig({ url, publishableKey }); } catch { return null; }
}

export function saveSupabaseConfig(config: SupabaseConfig): SupabaseConfig {
  const valid = validateSupabaseConfig(config);
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(valid));
  return valid;
}
