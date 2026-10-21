// Server-only Management API setup. A project secret key is deliberately never used here.
import { readFile } from 'node:fs/promises';
import { EnvHttpProxyAgent, fetch } from 'undici';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Schema/Auth configuration requires SUPABASE_ACCESS_TOKEN (Management API), or apply the migration with the SQL Editor/PostgreSQL and configure Auth in the dashboard. SUPABASE_SECRET_KEY cannot substitute for this capability.');
const projectRef = 'yiqquogdutgujsacoezh';
const dispatcher = new EnvHttpProxyAgent();
async function request(path, method = 'GET', body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/${path}`, {
    dispatcher, method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Management API ${method} ${path} returned HTTP ${response.status}; credentials and response body omitted.`);
  return response.json();
}
try {
  // Read authorization/configuration first. No secret-key SQL endpoint is assumed.
  const auth = await request('config/auth');
  const migration = await readFile(new URL('../supabase/migrations/202610210001_timesheet.sql', import.meta.url), 'utf8');
  await request('database/query', 'POST', { query: migration });
  const redirect = 'https://sigfriedjk.github.io/timesheet/**';
  const redirects = new Set((auth.uri_allow_list || '').split(',').map(value => value.trim()).filter(Boolean));
  redirects.add(redirect);
  await request('config/auth', 'PATCH', { site_url: 'https://sigfriedjk.github.io/timesheet/', uri_allow_list: [...redirects].join(',') });
  const verified = await request('config/auth');
  if (verified.site_url !== 'https://sigfriedjk.github.io/timesheet/' || !verified.uri_allow_list.split(',').includes(redirect)) throw new Error('Auth URL verification failed.');
  console.log('Migration applied; Auth Site URL and redirect allowlist verified. Existing redirect entries preserved. Run npm run verify:supabase next.');
} finally { await dispatcher.close(); }
