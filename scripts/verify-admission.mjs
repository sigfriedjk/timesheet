// Read-only owner verification. No accounts, emails, workspace writes, or session artifacts.
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { createManagementClient } from './supabase-management.mjs';
import { requireExistingOwner } from './supabase-admission.mjs';

const management = createManagementClient();
const dispatcher = new EnvHttpProxyAgent();
const projectUrl = 'https://yiqquogdutgujsacoezh.supabase.co';
const publicSource = await readFile(new URL('../src/config/supabasePublic.ts', import.meta.url), 'utf8');
const publicKey = publicSource.match(/DEFAULT_SUPABASE_PUBLISHABLE_KEY = '([^']+)'/)[1];
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (url, init) => fetch(url, { ...init, dispatcher }) } };
const client = createClient(projectUrl, publicKey, options);
function require(condition, message) { if (!condition) throw new Error(message); }
function checked(result, operation) {
  require(!result.error, `${operation} failed; account data and provider details omitted.`);
  return result.data;
}
async function snapshot() {
  return management.request('database/query', 'POST', { query: `
    select
      (select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id, date)::text, 'null')) from public.timesheet_logs t) as logs,
      (select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text, 'null')) from public.timesheet_reports t) as reports,
      (select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text, 'null')) from public.timesheet_pop_settings t) as pops` });
}
try {
  await requireExistingOwner(management.request);
  const before = await snapshot();
  const auth = await management.request('config/auth');
  require(auth.disable_signup === true && auth.external_anonymous_users_enabled === false && auth.external_email_enabled === true,
    'Single-owner admission settings must be applied before running verification.');
  console.log('Management readback: new signups off, anonymous sign-ins off, existing email sign-in on.');

  const email = `timesheet-denied-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  for (const [endpoint, body] of [
    ['signup', { email, password }],
    ['otp', { email, create_user: true }],
    ['otp', { email, create_user: false }],
    ['signup', {}],
  ]) {
    const response = await fetch(`${projectUrl}/auth/v1/${endpoint}`, {
      dispatcher, method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    const result = await response.json();
    require(response.status >= 400 && response.status < 500,
      `Unexpected response from denied ${endpoint} request; response contents omitted.`);
    const expectedCodes = endpoint === 'otp' ? ['otp_disabled', 'signup_disabled'] :
      Object.keys(body).length ? ['signup_disabled'] : ['anonymous_provider_disabled', 'signup_disabled'];
    require(expectedCodes.includes(result.error_code || result.code),
      `Denied ${endpoint} request did not return an admission-policy error; response contents omitted.`);
  }
  await requireExistingOwner(management.request);
  console.log('Direct password signup, OTP auto-creation, existing-user-only OTP for an unknown email, and anonymous signup are rejected; account count remains one.');

  require(process.env.SUPABASE_SECRET_KEY, 'Owner sign-in verification requires the server-side project secret.');
  const admin = createClient(projectUrl, process.env.SUPABASE_SECRET_KEY, options);
  const { users } = checked(await admin.auth.admin.listUsers({ page: 1, perPage: 2 }), 'Owner account lookup');
  require(users.length === 1 && users[0].email && users[0].email_confirmed_at && users[0].last_sign_in_at,
    'Expected the sole established owner; no sign-in attempted.');
  // Supported admin API generates a token but does not send an email. Consume it
  // immediately in memory and revoke only this test session when finished.
  const link = checked(await admin.auth.admin.generateLink({ type: 'magiclink', email: users[0].email }), 'Existing owner token generation');
  const signedIn = checked(await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' }), 'Existing owner sign-in');
  require(signedIn.user?.id === users[0].id && signedIn.session, 'Owner session verification failed.');
  const refreshed = checked(await client.auth.refreshSession(), 'Owner session refresh');
  require(refreshed.user?.id === users[0].id && refreshed.session, 'Refreshed owner identity changed.');
  for (const table of ['timesheet_logs', 'timesheet_reports', 'timesheet_pop_settings']) {
    const rows = checked(await client.from(table).select('*'), 'Owner workspace read');
    require(rows.every(row => row.user_id === users[0].id), 'Unexpected workspace ownership; row contents omitted.');
    const anonymous = createClient(projectUrl, publicKey, options);
    const denied = await anonymous.from(table).select('user_id').limit(1);
    require(denied.error || denied.data?.length === 0, 'Anonymous workspace access must be denied.');
  }
  require(JSON.stringify(before) === JSON.stringify(await snapshot()), 'Workspace changed during verification; investigate without printing its contents.');
  await requireExistingOwner(management.request);
  console.log('Existing owner sign-in, session refresh and RLS reads passed. Anonymous reads denied. Workspace hashes unchanged; no users created and no email sent.');
} finally {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) process.exitCode = 1;
  await dispatcher.close();
  await management.close();
}
