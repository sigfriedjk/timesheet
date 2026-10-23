// Server-only Management API setup. A project secret key is deliberately never used here.
import { readFile, readdir } from 'node:fs/promises';
import { configureSingleOwnerAuth } from './supabase-admission.mjs';
import { createManagementClient } from './supabase-management.mjs';
const management = createManagementClient();
const { request } = management;
try {
  // Refuse ambiguous/new projects before applying schema changes. Never reopen registration.
  await configureSingleOwnerAuth(request);
  // Read authorization/configuration first. No secret-key SQL endpoint is assumed.
  const auth = await request('config/auth');
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const migration = await readFile(new URL(name, directory), 'utf8');
    await request('database/query', 'POST', { query: migration });
  }
  console.log('Database migration applied, including owner RLS and restricted browser-role privileges.');
  const redirect = 'https://sigfriedjk.github.io/timesheet/**';
  const redirects = new Set((auth.uri_allow_list || '').split(',').map(value => value.trim()).filter(Boolean));
  redirects.add(redirect);
  if (auth.site_url !== 'https://sigfriedjk.github.io/timesheet/' || !auth.uri_allow_list?.split(',').map(value => value.trim()).includes(redirect)) {
    await request('config/auth', 'PATCH', { site_url: 'https://sigfriedjk.github.io/timesheet/', uri_allow_list: [...redirects].join(',') });
  }
  const verified = await request('config/auth');
  if (verified.site_url !== 'https://sigfriedjk.github.io/timesheet/' || !verified.uri_allow_list?.split(',').map(value => value.trim()).includes(redirect)) throw new Error('Auth URL verification failed.');
  console.log('Migration applied; Auth Site URL and redirect allowlist verified. Existing redirect entries preserved. Run npm run verify:admission next.');
} finally { await management.close(); }
